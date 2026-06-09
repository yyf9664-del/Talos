"""Tests for daily review API endpoints."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.dependencies import set_agent_registry, set_provider_registry
from app.agent.agent import AgentRegistry
from app.models.daily_review import DailyReview  # noqa: F401 - registers metadata
from app.schemas.provider import ModelInfo, StreamChunk

pytestmark = pytest.mark.asyncio


class FakeDailyReviewProvider:
    id = "fake-provider"

    async def stream_chat(self, model: str, messages: list[dict[str, Any]], **kwargs):
        assert model == "fake-model"
        assert kwargs["system"]
        assert "morning.md" in messages[-1]["content"]
        yield StreamChunk(
            type="text-delta",
            data={"text": "# 2026-06-06 每日回顾\n\n## 时间线\n- **09:15** — 早上散步。"},
        )
        yield StreamChunk(type="finish", data={})


class FakeProviderRegistry:
    def __init__(self) -> None:
        self.provider = FakeDailyReviewProvider()
        self.model = ModelInfo(
            id="fake-model",
            name="Fake Model",
            provider_id=self.provider.id,
        )

    def all_models(self):
        return [self.model]

    def resolve_model(self, model_id: str, provider_id: str | None = None):
        if model_id == self.model.id and provider_id in (None, self.provider.id):
            return self.provider, self.model
        return None


async def test_generate_daily_review_persists_history(app_client, tmp_path):
    registry = FakeProviderRegistry()
    set_provider_registry(registry)
    app_client.app.state.provider_registry = registry
    agent_registry = AgentRegistry()
    set_agent_registry(agent_registry)
    app_client.app.state.agent_registry = agent_registry

    note = tmp_path / "morning.md"
    note.write_text("早上散步，想到一个新想法。", encoding="utf-8")

    import os
    import time

    epoch = time.mktime((2026, 6, 6, 9, 15, 0, 0, 0, -1))
    os.utime(note, (epoch, epoch))

    resp = await app_client.post(
        "/api/daily-reviews/generate",
        json={
            "folder_path": str(tmp_path),
            "review_date": "2026-06-06",
            "model": "fake-model",
        },
    )

    assert resp.status_code == 200
    generated = resp.json()
    assert generated["review_date"] == "2026-06-06"
    assert generated["folder_path"] == str(tmp_path.resolve())
    assert "早上散步" in generated["content_markdown"]
    assert generated["source_files"][0]["relative_path"] == "morning.md"

    list_resp = await app_client.get("/api/daily-reviews")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert [item["id"] for item in items] == [generated["id"]]

    overwrite_resp = await app_client.post(
        "/api/daily-reviews/generate",
        json={
            "folder_path": str(tmp_path),
            "review_date": "2026-06-06",
            "model": "fake-model",
        },
    )
    assert overwrite_resp.status_code == 200
    overwritten = overwrite_resp.json()
    assert overwritten["id"] == generated["id"]

    list_resp = await app_client.get("/api/daily-reviews")
    assert list_resp.status_code == 200
    assert [item["id"] for item in list_resp.json()] == [generated["id"]]

    detail_resp = await app_client.get(f"/api/daily-reviews/{generated['id']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["content_markdown"] == generated["content_markdown"]

    delete_resp = await app_client.delete(f"/api/daily-reviews/{generated['id']}")
    assert delete_resp.status_code == 200
    assert delete_resp.json() == {"success": True}

    empty_resp = await app_client.get("/api/daily-reviews")
    assert empty_resp.status_code == 200
    assert empty_resp.json() == []


async def test_generate_daily_review_returns_400_when_no_sources(app_client, tmp_path):
    registry = FakeProviderRegistry()
    set_provider_registry(registry)
    app_client.app.state.provider_registry = registry
    agent_registry = AgentRegistry()
    set_agent_registry(agent_registry)
    app_client.app.state.agent_registry = agent_registry

    resp = await app_client.post(
        "/api/daily-reviews/generate",
        json={
            "folder_path": str(tmp_path),
            "review_date": date(2026, 6, 6).isoformat(),
            "model": "fake-model",
        },
    )

    assert resp.status_code == 400
    assert "No readable files" in resp.json()["detail"]
