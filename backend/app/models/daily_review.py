"""Daily review history model."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import Date, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.utils.id import generate_ulid


class DailyReview(Base, TimestampMixin):
    """A generated diary-style daily review saved in local history."""

    __tablename__ = "daily_review"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_ulid)
    review_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    folder_path: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    source_files: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String, nullable=True)
