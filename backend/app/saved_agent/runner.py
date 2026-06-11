"""Build run prompts and launch headless sessions for Saved Agents."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# A single-line, machine-readable marker prepended to saved-agent run prompts.
# The model tolerates the HTML comment; the chat UI parses it to render a
# compact "agent name + input chips" card instead of the full prompt body.
SAVED_AGENT_RUN_MARKER_PREFIX = "<!-- saved-agent-run: "
SAVED_AGENT_RUN_MARKER_SUFFIX = " -->"


def _run_marker(*, title: str, form_schema: list[dict[str, Any]], inputs: dict[str, Any]) -> str:
    by_id = {f["id"]: f for f in form_schema if isinstance(f, dict)}
    chips = [
        {"key": by_id.get(fid, {}).get("name") or fid, "value": str(value)}
        for fid, value in inputs.items()
    ]
    payload = json.dumps({"title": title, "inputs": chips}, ensure_ascii=False)
    return f"{SAVED_AGENT_RUN_MARKER_PREFIX}{payload}{SAVED_AGENT_RUN_MARKER_SUFFIX}"


def build_run_prompt(
    *, title: str, skill_content: str, form_schema: list[dict[str, Any]], inputs: dict[str, Any]
) -> str:
    lines = [
        _run_marker(title=title, form_schema=form_schema, inputs=inputs),
        f"Run the Saved Agent: {title}.",
        "",
        "## Inputs",
    ]
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
    session_factory, provider_registry, agent_registry, tool_registry, stream_manager,
    provider_id: str | None = None, index_manager=None,
) -> tuple[str, str]:
    """Create a headless session and run it in the background.

    Registers the job with the StreamManager so it is discoverable via
    ``/api/chat/active`` and attachable over SSE. Returns ``(session_id, stream_id)``.
    """
    from app.schemas.chat import PromptRequest
    from app.session.processor import run_generation
    from app.utils.id import generate_ulid

    session_id = generate_ulid()
    stream_id = generate_ulid()
    prompt = build_run_prompt(
        title=saved_agent.title, skill_content=saved_agent.skill_content,
        form_schema=saved_agent.form_schema, inputs=inputs,
    )
    job = stream_manager.create_job(stream_id=stream_id, session_id=session_id)
    request = PromptRequest(
        session_id=session_id, text=prompt, model=model, provider_id=provider_id,
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
    return session_id, stream_id
