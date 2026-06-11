"""Build run prompts and launch headless sessions for Saved Agents."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def build_run_prompt(
    *, title: str, skill_content: str, form_schema: list[dict[str, Any]], inputs: dict[str, Any]
) -> str:
    lines = [f"Run the Saved Agent: {title}.", "", "## Inputs"]
    by_id = {f["id"]: f for f in form_schema if isinstance(f, dict)}
    for fid, value in inputs.items():
        label = by_id.get(fid, {}).get("name", fid)
        lines.append(f"- {label} ({fid}): {value}")
    if not inputs:
        lines.append("- (no inputs)")
    lines += [
        "",
        "Follow the procedure below exactly. Use the inputs above.",
        "",
        "## SKILL",
        skill_content,
    ]
    return "\n".join(lines)


async def launch_run(
    *, saved_agent, inputs: dict[str, Any], model: str | None,
    session_factory, provider_registry, agent_registry, tool_registry, index_manager=None,
) -> str:
    """Create a headless session and run it in the background. Returns session_id."""
    from app.schemas.chat import PromptRequest
    from app.session.processor import run_generation
    from app.streaming.manager import GenerationJob
    from app.utils.id import generate_ulid

    session_id = generate_ulid()
    prompt = build_run_prompt(
        title=saved_agent.title, skill_content=saved_agent.skill_content,
        form_schema=saved_agent.form_schema, inputs=inputs,
    )
    job = GenerationJob(stream_id=generate_ulid(), session_id=session_id)
    request = PromptRequest(
        session_id=session_id, text=prompt, model=model,
        agent="build", workspace=saved_agent.workspace_path,
    )

    async def _run():
        try:
            await asyncio.wait_for(
                run_generation(
                    job, request, session_factory=session_factory,
                    provider_registry=provider_registry, agent_registry=agent_registry,
                    tool_registry=tool_registry, index_manager=index_manager,
                ),
                timeout=1800,
            )
        except Exception as e:
            logger.warning("Saved Agent run %s failed: %s", session_id, e)

    task = asyncio.create_task(_run(), name=f"saved-agent-run-{session_id[:12]}")
    job.task = task
    return session_id
