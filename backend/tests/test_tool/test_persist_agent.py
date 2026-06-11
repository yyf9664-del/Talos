import pytest
from app.tool.builtin.persist_agent import PersistAgentTool
from app.tool.context import ToolContext
from app.schemas.agent import AgentInfo, Ruleset


def _ctx(tmp_path, session_factory):
    ctx = ToolContext(
        session_id="src-sess", message_id="m1",
        agent=AgentInfo(name="persist", description="", mode="hidden", tools=["persist_agent"],
                        permissions=Ruleset(), system_prompt=""),
        call_id="c1", workspace=str(tmp_path),
    )
    ctx._app_state = {"session_factory": session_factory}  # type: ignore[attr-defined]
    return ctx


@pytest.mark.asyncio
async def test_persist_agent_creates_row(tmp_path, session_factory):
    tool = PersistAgentTool()
    ctx = _ctx(tmp_path, session_factory)
    result = await tool.execute({
        "identifier": "weather", "title": "Weather", "description": "daily",
        "skill_content": "# Weather\n## Goal\n...",
        "form_schema": [{"id": "city", "type": "string", "required": True}],
        "memory_schema": {"persist_fields": ["city"], "aggregations": []},
    }, ctx)
    assert result.success, result.error
    assert "weather" in result.output.lower()

    from app.saved_agent.storage import list_saved_agents
    async with session_factory() as db:
        items = await list_saved_agents(db, workspace_path=str(tmp_path))
    assert len(items) == 1 and items[0].identifier == "weather"


@pytest.mark.asyncio
async def test_persist_agent_rejects_bad_form(tmp_path, session_factory):
    tool = PersistAgentTool()
    ctx = _ctx(tmp_path, session_factory)
    result = await tool.execute({
        "identifier": "bad", "title": "Bad", "skill_content": "#x",
        "form_schema": [{"id": "d", "type": "select"}],  # select 缺 options
    }, ctx)
    assert not result.success
    assert "options" in result.error


@pytest.mark.asyncio
async def test_persist_agent_rejects_bad_identifier(tmp_path, session_factory):
    tool = PersistAgentTool()
    ctx = _ctx(tmp_path, session_factory)
    result = await tool.execute({
        "identifier": "../evil", "title": "Evil", "skill_content": "#x",
        "form_schema": [{"id": "city", "type": "string"}],
    }, ctx)
    assert not result.success
    assert "identifier" in result.error


@pytest.mark.asyncio
async def test_persist_agent_missing_app_state(tmp_path):
    tool = PersistAgentTool()
    ctx = ToolContext(
        session_id="s", message_id="m", call_id="c", workspace=str(tmp_path),
        agent=AgentInfo(name="persist", description="", mode="hidden", tools=[],
                        permissions=Ruleset(), system_prompt=""),
    )
    result = await tool.execute({"identifier": "x", "title": "X", "skill_content": "#x",
                                 "form_schema": []}, ctx)
    assert not result.success
