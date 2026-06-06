"""Employee login session helpers for the optional auth gate."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from pathlib import Path
from typing import Any

from app.config import Settings
from app.auth.token import load_token

COOKIE_NAME = "openyak_employee_session"


def _secret(settings: Settings) -> bytes:
    configured = settings.auth_session_secret.strip()
    if configured:
        return configured.encode("utf-8")
    # Use the per-run local API token as a strong desktop default. Packaged
    # enterprise builds can set OPENYAK_AUTH_SESSION_SECRET to keep sessions
    # valid across backend restarts.
    session_token = load_token(Path(settings.session_token_path))
    fallback = session_token or settings.session_token_path or "openyak"
    return hashlib.sha256(fallback.encode("utf-8")).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def sign_user_session(user: dict[str, Any], settings: Settings) -> str:
    now = int(time.time())
    ttl_seconds = max(1, settings.auth_session_ttl_hours) * 3600
    payload = {
        "v": 1,
        "iat": now,
        "exp": now + ttl_seconds,
        "nonce": secrets.token_urlsafe(8),
        "user": user,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded = _b64(payload_bytes)
    sig = hmac.new(_secret(settings), encoded.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded}.{_b64(sig)}"


def verify_user_session(token: str | None, settings: Settings) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    encoded, sig = token.split(".", 1)
    expected = hmac.new(_secret(settings), encoded.encode("ascii"), hashlib.sha256).digest()
    try:
        provided = _unb64(sig)
    except Exception:
        return None
    if not hmac.compare_digest(provided, expected):
        return None
    try:
        payload = json.loads(_unb64(encoded).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0) or 0) < int(time.time()):
        return None
    user = payload.get("user")
    return user if isinstance(user, dict) else None
