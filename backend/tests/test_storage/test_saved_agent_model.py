import pytest
from sqlalchemy import select
from app.models.saved_agent import SavedAgent


@pytest.mark.asyncio
async def test_saved_agent_insert_and_query(db):
    agent = SavedAgent(
        workspace_path="/tmp/ws",
        identifier="weather-report",
        title="Weather Report",
        description="Daily weather",
        skill_content="# Weather\n## Goal\n...",
        form_schema=[{"id": "city", "type": "string", "required": True}],
        memory_schema={"persist_fields": ["city", "temperature"], "aggregations": []},
        source_session_id="sess-1",
    )
    db.add(agent)
    await db.flush()

    row = (await db.execute(select(SavedAgent).where(SavedAgent.identifier == "weather-report"))).scalar_one()
    assert row.title == "Weather Report"
    assert row.form_schema[0]["id"] == "city"
    assert row.version == "1.0.0"
    assert row.id
    assert row.time_created is not None
