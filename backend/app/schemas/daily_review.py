"""Daily review request and response schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class DailyReviewGenerateRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)
    review_date: date
    model: str | None = None


class DailyReviewResponse(BaseModel):
    id: str
    review_date: date
    folder_path: str
    title: str
    content_markdown: str
    source_files: list[dict[str, Any]]
    model: str | None
    provider_id: str | None
    time_created: datetime
    time_updated: datetime

    model_config = {"from_attributes": True}


class DailyReviewListResponse(BaseModel):
    id: str
    review_date: date
    folder_path: str
    title: str
    source_files: list[dict[str, Any]]
    model: str | None
    provider_id: str | None
    time_created: datetime
    time_updated: datetime

    model_config = {"from_attributes": True}
