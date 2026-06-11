"""Persistence + on-disk bundle export for Saved Agents."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.saved_agent import SavedAgent

logger = logging.getLogger(__name__)


def _bump_patch(version: str) -> str:
    try:
        major, minor, patch = (version or "1.0.0").split(".")
        return f"{major}.{minor}.{int(patch) + 1}"
    except Exception:
        return "1.0.1"


async def get_saved_agent(db: AsyncSession, agent_id: str) -> SavedAgent | None:
    return (await db.execute(select(SavedAgent).where(SavedAgent.id == agent_id))).scalar_one_or_none()


async def list_saved_agents(db: AsyncSession, *, workspace_path: str) -> list[SavedAgent]:
    rows = (await db.execute(
        select(SavedAgent).where(SavedAgent.workspace_path == workspace_path)
        .order_by(SavedAgent.time_updated.desc())
    )).scalars().all()
    return list(rows)


async def upsert_saved_agent(
    db: AsyncSession, *, workspace_path: str, identifier: str, title: str,
    description: str, skill_content: str, form_schema: list[dict[str, Any]],
    memory_schema: dict[str, Any], source_session_id: str | None = None,
) -> SavedAgent:
    existing = (await db.execute(
        select(SavedAgent).where(
            SavedAgent.workspace_path == workspace_path,
            SavedAgent.identifier == identifier,
        )
    )).scalar_one_or_none()

    if existing is None:
        agent = SavedAgent(
            workspace_path=workspace_path, identifier=identifier, title=title,
            description=description, version="1.0.0", skill_content=skill_content,
            form_schema=form_schema, memory_schema=memory_schema,
            source_session_id=source_session_id,
        )
        db.add(agent)
    else:
        existing.title = title
        existing.description = description
        existing.skill_content = skill_content
        existing.form_schema = form_schema
        existing.memory_schema = memory_schema
        existing.version = _bump_patch(existing.version)
        if source_session_id:
            existing.source_session_id = source_session_id
        agent = existing

    _write_bundle(agent)
    return agent


def _write_bundle(agent: SavedAgent) -> None:
    """Export SKILL.md + manifest.yaml to .openyak/saved-agents/<id>/. Best-effort."""
    try:
        bundle = Path(agent.workspace_path) / ".openyak" / "saved-agents" / agent.identifier
        (bundle / "files").mkdir(parents=True, exist_ok=True)

        fm_body = yaml.safe_dump(
            {"name": agent.identifier, "description": agent.description},
            allow_unicode=True, sort_keys=False,
        )
        frontmatter = f"---\n{fm_body}---\n\n"
        (bundle / "SKILL.md").write_text(frontmatter + agent.skill_content, encoding="utf-8")

        manifest = {
            "name": agent.title,
            "description": agent.description,
            "version": agent.version,
            "form": agent.form_schema,
            "memory": agent.memory_schema,
        }
        (bundle / "manifest.yaml").write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
    except OSError as e:
        logger.warning("Could not write saved-agent bundle for %s: %s", agent.identifier, e)
