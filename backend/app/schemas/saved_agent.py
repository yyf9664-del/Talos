from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SavedAgentCreate(BaseModel):
    workspace_path: str
    identifier: str
    title: str
    description: str = ""
    skill_content: str
    form_schema: list[dict[str, Any]] = []
    memory_schema: dict[str, Any] = {}
    source_session_id: str | None = None


class SavedAgentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    skill_content: str | None = None
    form_schema: list[dict[str, Any]] | None = None
    memory_schema: dict[str, Any] | None = None


class SavedAgentResponse(BaseModel):
    id: str
    workspace_path: str
    identifier: str
    title: str
    description: str
    version: str
    skill_content: str
    form_schema: list[dict[str, Any]]
    memory_schema: dict[str, Any]
    source_session_id: str | None
    time_created: datetime
    time_updated: datetime

    model_config = {"from_attributes": True}


class RunRequest(BaseModel):
    inputs: dict[str, Any] = {}
    model: str | None = None


class RunResponse(BaseModel):
    session_id: str
    stream_id: str
    status: str = "started"
