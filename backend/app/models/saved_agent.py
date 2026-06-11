"""SavedAgent model — a session persisted as a reusable, form-driven agent."""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.utils.id import generate_ulid


class SavedAgent(Base, TimestampMixin):
    __tablename__ = "saved_agent"
    __table_args__ = (
        UniqueConstraint("workspace_path", "identifier", name="uq_saved_agent_ws_identifier"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_ulid)

    workspace_path: Mapped[str] = mapped_column(String, nullable=False, index=True)
    identifier: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    version: Mapped[str] = mapped_column(String, nullable=False, default="1.0.0")

    skill_content: Mapped[str] = mapped_column(String, nullable=False)
    form_schema: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    memory_schema: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    source_session_id: Mapped[str | None] = mapped_column(String, nullable=True)
