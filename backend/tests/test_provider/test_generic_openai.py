from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.provider.generic_openai import GenericOpenAIProvider


pytestmark = pytest.mark.asyncio


async def test_validate_connection_uses_chat_completion_for_manual_models():
    provider = GenericOpenAIProvider(
        "test-key",
        provider_id="custom_taishi",
        base_url="https://example.test/v1",
        kind="openai_compat_custom",
        models_override=[{"id": "kimi-k2.6", "name": "kimi-k2.6"}],
    )
    provider._client.chat.completions.create = AsyncMock(return_value=object())

    await provider.validate_connection("kimi-k2.6")

    provider._client.chat.completions.create.assert_awaited_once()
    kwargs = provider._client.chat.completions.create.await_args.kwargs
    assert kwargs["model"] == "kimi-k2.6"
    assert kwargs["stream"] is False
