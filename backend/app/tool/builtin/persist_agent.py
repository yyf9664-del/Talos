"""persist_agent tool — turn the current session into a reusable Saved Agent."""

from __future__ import annotations

import logging
from typing import Any

from app.tool.base import ToolDefinition, ToolResult
from app.tool.context import ToolContext

logger = logging.getLogger(__name__)


class PersistAgentTool(ToolDefinition):

    @property
    def id(self) -> str:
        return "persist_agent"

    @property
    def description(self) -> str:
        return (
            "Persist the current session as a reusable, form-driven Saved Agent. "
            "Provide a stable kebab-case identifier, a SKILL.md body (Goal/Inputs/"
            "Procedure/Output), a form_schema of structured inputs, and a memory_schema. "
            "Call this exactly once when the user asks to 'turn into an agent' / 'save as agent'."
        )

    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "identifier": {"type": "string", "description": "Stable kebab-case id, unique per workspace"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "skill_content": {"type": "string", "description": "SKILL.md body: Goal/Inputs/Procedure/Output"},
                "form_schema": {"type": "array", "description": "List of form field definitions"},
                "memory_schema": {"type": "object", "description": "{persist_fields, aggregations}"},
            },
            "required": ["identifier", "title", "skill_content", "form_schema"],
        }

    async def execute(self, args: dict[str, Any], ctx: ToolContext) -> ToolResult:
        from app.saved_agent.form_schema import validate_form_schema, validate_identifier
        from app.saved_agent.storage import upsert_saved_agent

        app_state = getattr(ctx, "_app_state", None)
        if not app_state:
            return ToolResult(error="persist_agent unavailable: missing app state (must run inside a session)")
        session_factory = app_state["session_factory"]

        workspace = ctx.workspace or "."
        form_schema = args.get("form_schema", [])

        identifier = args.get("identifier", "")
        id_error = validate_identifier(identifier)
        if id_error:
            return ToolResult(error=f"Invalid identifier: {id_error}")

        schema_errors = validate_form_schema(form_schema)
        if schema_errors:
            return ToolResult(error="Invalid form_schema: " + "; ".join(schema_errors))

        try:
            async with session_factory() as db:
                async with db.begin():
                    agent = await upsert_saved_agent(
                        db,
                        workspace_path=workspace,
                        identifier=args["identifier"],
                        title=args["title"],
                        description=args.get("description", ""),
                        skill_content=args["skill_content"],
                        form_schema=form_schema,
                        memory_schema=args.get("memory_schema", {}),
                        source_session_id=ctx.session_id,
                    )
                    await db.flush()
                    agent_id = agent.id
                    version = agent.version
        except Exception as e:
            logger.exception("persist_agent failed")
            return ToolResult(error=f"Failed to persist agent: {e}")

        field_ids = [f.get("id") for f in form_schema if isinstance(f, dict)]
        return ToolResult(
            output=(
                f"Saved Agent '{args['title']}' (id={args['identifier']}, v{version}) registered.\n"
                f"Form inputs: {', '.join(field_ids) or '(none)'}"
            ),
            title=f"Saved Agent: {args['title']}",
            metadata={"saved_agent_id": agent_id, "identifier": args["identifier"]},
        )
