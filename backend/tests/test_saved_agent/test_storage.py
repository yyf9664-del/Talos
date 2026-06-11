import pytest
from app.saved_agent.storage import upsert_saved_agent, list_saved_agents, get_saved_agent


@pytest.mark.asyncio
async def test_upsert_creates_then_updates(db, tmp_path):
    ws = str(tmp_path)
    a1 = await upsert_saved_agent(
        db, workspace_path=ws, identifier="rep",
        title="Rep", description="d", skill_content="# Rep",
        form_schema=[{"id": "x", "type": "string"}],
        memory_schema={"persist_fields": ["x"], "aggregations": []},
        source_session_id="s1",
    )
    await db.flush()
    assert a1.version == "1.0.0"

    bundle = tmp_path / ".openyak" / "saved-agents" / "rep"
    assert (bundle / "SKILL.md").read_text().startswith("---")
    assert (bundle / "manifest.yaml").exists()

    a2 = await upsert_saved_agent(
        db, workspace_path=ws, identifier="rep",
        title="Rep v2", description="d2", skill_content="# Rep v2",
        form_schema=[{"id": "x", "type": "string"}], memory_schema={}, source_session_id="s1",
    )
    await db.flush()
    assert a2.id == a1.id
    assert a2.title == "Rep v2"
    assert a2.version == "1.0.1"


@pytest.mark.asyncio
async def test_list_and_get(db, tmp_path):
    ws = str(tmp_path)
    await upsert_saved_agent(db, workspace_path=ws, identifier="a", title="A",
                             description="", skill_content="#A", form_schema=[], memory_schema={})
    await db.flush()
    items = await list_saved_agents(db, workspace_path=ws)
    assert len(items) == 1
    got = await get_saved_agent(db, items[0].id)
    assert got.identifier == "a"
