from app.agent.agent import AgentRegistry


def test_persist_agent_registered_and_hidden():
    reg = AgentRegistry()
    agent = reg.get("persist")
    assert agent is not None
    assert agent.mode == "hidden"
    assert agent.tools == ["persist_agent"]
    assert "persist" not in [a.name for a in reg.list_agents(include_hidden=False)]
    assert agent.system_prompt
