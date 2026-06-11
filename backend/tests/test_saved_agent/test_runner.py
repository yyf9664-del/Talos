from app.saved_agent.runner import build_run_prompt


def test_build_run_prompt_injects_inputs_and_skill():
    skill = "# Weather\n## Procedure\n1. fetch"
    prompt = build_run_prompt(
        title="Weather", skill_content=skill,
        form_schema=[{"id": "city", "name": "City", "type": "string"}],
        inputs={"city": "Tokyo"},
    )
    assert "Tokyo" in prompt
    assert "city" in prompt
    assert "## Procedure" in prompt
    assert "Weather" in prompt
