import json

from app.saved_agent.runner import (
    SAVED_AGENT_RUN_MARKER_PREFIX,
    SAVED_AGENT_RUN_MARKER_SUFFIX,
    build_run_prompt,
)


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


def test_build_run_prompt_prepends_parseable_marker():
    prompt = build_run_prompt(
        title="贵金属价格报告",
        skill_content="# Goal",
        form_schema=[
            {"id": "commodity", "name": "commodity", "type": "string"},
            {"id": "days", "name": "days", "type": "integer"},
        ],
        inputs={"commodity": "gold", "days": 30},
    )
    first_line = prompt.splitlines()[0]
    assert first_line.startswith(SAVED_AGENT_RUN_MARKER_PREFIX)
    assert first_line.endswith(SAVED_AGENT_RUN_MARKER_SUFFIX)
    payload = json.loads(
        first_line[len(SAVED_AGENT_RUN_MARKER_PREFIX):-len(SAVED_AGENT_RUN_MARKER_SUFFIX)]
    )
    assert payload["title"] == "贵金属价格报告"
    assert {"key": "commodity", "value": "gold"} in payload["inputs"]
    assert {"key": "days", "value": "30"} in payload["inputs"]
