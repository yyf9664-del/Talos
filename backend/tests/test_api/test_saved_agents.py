import pytest


@pytest.mark.asyncio
async def test_crud_flow(app_client, tmp_path):
    ws = str(tmp_path)
    payload = {
        "workspace_path": ws, "identifier": "rep", "title": "Rep",
        "description": "d", "skill_content": "# Rep",
        "form_schema": [{"id": "city", "type": "string", "required": True}],
        "memory_schema": {"persist_fields": ["city"], "aggregations": []},
    }
    r = await app_client.post("/api/saved-agents", json=payload)
    assert r.status_code == 200, r.text
    agent_id = r.json()["id"]

    r = await app_client.get(f"/api/saved-agents?workspace={ws}")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r = await app_client.get(f"/api/saved-agents/{agent_id}")
    assert r.json()["identifier"] == "rep"

    r = await app_client.delete(f"/api/saved-agents/{agent_id}")
    assert r.status_code == 200
    r = await app_client.get(f"/api/saved-agents?workspace={ws}")
    assert len(r.json()) == 0


@pytest.mark.asyncio
async def test_create_rejects_bad_form_schema(app_client, tmp_path):
    payload = {
        "workspace_path": str(tmp_path), "identifier": "bad", "title": "Bad",
        "skill_content": "#x", "form_schema": [{"id": "d", "type": "select"}],
        "memory_schema": {},
    }
    r = await app_client.post("/api/saved-agents", json=payload)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_rejects_bad_identifier(app_client, tmp_path):
    payload = {
        "workspace_path": str(tmp_path), "identifier": "../evil", "title": "Evil",
        "skill_content": "# Evil",
        "form_schema": [{"id": "city", "type": "string"}],
        "memory_schema": {},
    }
    r = await app_client.post("/api/saved-agents", json=payload)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_run_validates_inputs(app_client, tmp_path, monkeypatch):
    ws = str(tmp_path)
    r = await app_client.post("/api/saved-agents", json={
        "workspace_path": ws, "identifier": "rep", "title": "Rep", "skill_content": "#x",
        "form_schema": [{"id": "city", "type": "string", "required": True}], "memory_schema": {},
    })
    agent_id = r.json()["id"]

    r = await app_client.post(f"/api/saved-agents/{agent_id}/run", json={"inputs": {}})
    assert r.status_code == 422

    import app.api.saved_agents as mod
    async def _fake_launch(**kwargs):
        return "fake-session", "fake-stream"
    monkeypatch.setattr(mod, "launch_run", _fake_launch)

    r = await app_client.post(f"/api/saved-agents/{agent_id}/run", json={"inputs": {"city": "Tokyo"}})
    assert r.status_code == 200
    assert r.json()["session_id"] == "fake-session"
    assert r.json()["stream_id"] == "fake-stream"


@pytest.mark.asyncio
async def test_run_unknown_agent_returns_404(app_client):
    r = await app_client.post("/api/saved-agents/nonexistent-id/run", json={"inputs": {}})
    assert r.status_code == 404
