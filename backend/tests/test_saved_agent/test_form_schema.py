import pytest
from app.saved_agent.form_schema import validate_form_schema, validate_inputs


def test_valid_schema_passes():
    schema = [
        {"id": "city", "type": "string", "required": True},
        {"id": "depth", "type": "select", "required": True,
         "options": [{"label": "Quick", "value": "q"}, {"label": "Deep", "value": "d"}]},
    ]
    assert validate_form_schema(schema) == []


def test_select_without_options_is_error():
    errs = validate_form_schema([{"id": "depth", "type": "select", "required": True}])
    assert any("options" in e for e in errs)


def test_unknown_type_is_error():
    errs = validate_form_schema([{"id": "x", "type": "color"}])
    assert any("type" in e for e in errs)


def test_missing_id_is_error():
    errs = validate_form_schema([{"type": "string"}])
    assert any("id" in e for e in errs)


def test_duplicate_id_is_error():
    errs = validate_form_schema([{"id": "a", "type": "string"}, {"id": "a", "type": "number"}])
    assert any("duplicate" in e.lower() for e in errs)


def test_inputs_required_missing():
    schema = [{"id": "city", "type": "string", "required": True}]
    errs = validate_inputs(schema, {})
    assert any("city" in e for e in errs)


def test_inputs_type_check():
    schema = [{"id": "n", "type": "integer", "required": True}]
    assert validate_inputs(schema, {"n": 5}) == []
    assert any("n" in e for e in validate_inputs(schema, {"n": "abc"}))


def test_inputs_integer_rejects_bool():
    schema = [{"id": "n", "type": "integer", "required": True}]
    assert any("n" in e for e in validate_inputs(schema, {"n": True}))


def test_inputs_multiselect_three_states():
    schema = [{"id": "tags", "type": "multiselect", "required": True,
               "options": [{"label": "A", "value": "a"}, {"label": "B", "value": "b"}]}]
    assert validate_inputs(schema, {"tags": ["a", "b"]}) == []
    assert any("tags" in e for e in validate_inputs(schema, {"tags": ["a", "zzz"]}))
    assert any("tags" in e for e in validate_inputs(schema, {"tags": "a"}))


def test_inputs_select_value_must_be_in_options():
    schema = [{"id": "d", "type": "select", "required": True,
               "options": [{"label": "Q", "value": "q"}]}]
    assert validate_inputs(schema, {"d": "q"}) == []
    assert any("d" in e for e in validate_inputs(schema, {"d": "zzz"}))
