"""Pure validators for Saved Agent form schemas and run inputs."""

from __future__ import annotations

import re
from typing import Any

VALID_TYPES = {
    "string", "textarea", "number", "integer", "boolean", "select", "multiselect",
    "file", "files",
}
OPTION_TYPES = {"select", "multiselect"}

_IDENTIFIER_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_identifier(identifier: str) -> str | None:
    """Return error string if invalid, else None."""
    if not isinstance(identifier, str) or not (1 <= len(identifier) <= 64):
        return "identifier must be a non-empty string (<=64 chars)"
    if not _IDENTIFIER_RE.match(identifier):
        return "identifier must be kebab-case (lowercase letters/digits, hyphen-separated)"
    return None


def validate_form_schema(schema: Any) -> list[str]:
    """Validate a form field definition list. Returns list of error strings (empty = ok)."""
    errors: list[str] = []
    if not isinstance(schema, list):
        return ["form_schema must be a list of field definitions"]

    seen_ids: set[str] = set()
    for i, field in enumerate(schema):
        if not isinstance(field, dict):
            errors.append(f"field[{i}] must be an object")
            continue
        fid = field.get("id")
        if not fid or not isinstance(fid, str):
            errors.append(f"field[{i}] missing required string 'id'")
        else:
            if fid in seen_ids:
                errors.append(f"field '{fid}': duplicate id")
            seen_ids.add(fid)

        label = f"'{fid}'" if fid and isinstance(fid, str) else f"[{i}]"

        ftype = field.get("type")
        if ftype not in VALID_TYPES:
            errors.append(f"field {label}: invalid type '{ftype}'")

        if ftype in OPTION_TYPES:
            opts = field.get("options")
            if not isinstance(opts, list) or not opts:
                errors.append(f"field {label}: type '{ftype}' requires non-empty 'options'")
            else:
                for opt in opts:
                    if not isinstance(opt, dict) or not opt.get("value"):
                        errors.append(f"field {label}: each option needs a non-empty 'value'")
                        break
    return errors


def validate_inputs(schema: list[dict[str, Any]], inputs: dict[str, Any]) -> list[str]:
    """Validate run inputs against a (already-valid) form schema."""
    errors: list[str] = []
    inputs = inputs or {}

    for field in schema:
        fid = field["id"]
        ftype = field.get("type", "string")
        required = field.get("required", False)
        present = fid in inputs and inputs[fid] not in (None, "")

        if required and not present:
            errors.append(f"field '{fid}' is required")
            continue
        if not present:
            continue

        value = inputs[fid]
        if ftype == "number" and (isinstance(value, bool) or not isinstance(value, (int, float))):
            errors.append(f"field '{fid}': expected number")
        elif ftype == "integer" and (isinstance(value, bool) or not isinstance(value, int)):
            errors.append(f"field '{fid}': expected integer")
        elif ftype == "boolean" and not isinstance(value, bool):
            errors.append(f"field '{fid}': expected boolean")
        elif ftype == "multiselect" and not isinstance(value, list):
            errors.append(f"field '{fid}': expected list")
        elif ftype in ("string", "textarea", "select") and not isinstance(value, str):
            errors.append(f"field '{fid}': expected string")

        if ftype in OPTION_TYPES:
            allowed = {o["value"] for o in field.get("options", [])}
            values = value if isinstance(value, list) else [value]
            for v in values:
                if v not in allowed:
                    errors.append(f"field '{fid}': value '{v}' not in options")
    return errors
