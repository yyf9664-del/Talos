"""Employee key login endpoints for internal desktop distribution."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.auth.user_session import COOKIE_NAME, sign_user_session, verify_user_session
from app.dependencies import SettingsDep

router = APIRouter(prefix="/auth")


class KeyLoginRequest(BaseModel):
    key: str


class AuthUser(BaseModel):
    id: int | str | None = None
    username: str = ""
    name: str = ""
    email: str = ""
    studio_id: int | str | None = None
    studio_display: str = ""
    group_list: list[dict[str, Any]] = []
    super_user: bool = False


class AuthStatus(BaseModel):
    auth_enabled: bool
    authenticated: bool
    user: AuthUser | None = None


def _normalize_user(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": raw.get("id"),
        "username": str(raw.get("username") or ""),
        "name": str(raw.get("name") or ""),
        "email": str(raw.get("email") or ""),
        "studio_id": raw.get("studio_id"),
        "studio_display": str(raw.get("studio_display") or ""),
        "group_list": raw.get("group_list") if isinstance(raw.get("group_list"), list) else [],
        "super_user": bool(raw.get("super_user") or False),
    }


async def _fetch_userinfo(key: str, settings) -> dict[str, Any]:
    url = settings.auth_userinfo_url.strip()
    if not url:
        raise HTTPException(500, "Employee auth is enabled but userinfo URL is not configured")

    header_name = settings.auth_api_key_header.strip() or "X-API-KEY"
    headers = {header_name: key}
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            res = await client.get(url, headers=headers)
        except httpx.HTTPError as exc:
            raise HTTPException(502, f"Unable to reach employee auth service: {exc}") from exc

    if res.status_code in (401, 403):
        raise HTTPException(401, "Invalid employee key")
    if res.status_code >= 400:
        raise HTTPException(502, f"Employee auth service returned HTTP {res.status_code}")

    try:
        payload = res.json()
    except ValueError as exc:
        raise HTTPException(502, "Employee auth service returned invalid JSON") from exc

    if not isinstance(payload, dict) or payload.get("code") != 0:
        raise HTTPException(401, "Employee key was rejected")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(502, "Employee auth service response is missing user data")
    return _normalize_user(data)


@router.get("/me", response_model=AuthStatus)
async def me(request: Request, settings: SettingsDep) -> AuthStatus:
    if not settings.auth_enabled:
        return AuthStatus(auth_enabled=False, authenticated=True, user=None)
    token = request.cookies.get(COOKIE_NAME)
    user = verify_user_session(token, settings)
    if user is None:
        return AuthStatus(auth_enabled=True, authenticated=False, user=None)
    return AuthStatus(auth_enabled=True, authenticated=True, user=AuthUser(**user))


@router.post("/key-login", response_model=AuthStatus)
async def key_login(body: KeyLoginRequest, response: Response, settings: SettingsDep) -> AuthStatus:
    key = body.key.strip()
    if not key:
        raise HTTPException(400, "Employee key cannot be empty")

    user = await _fetch_userinfo(key, settings)
    if not user.get("id") and not user.get("email") and not user.get("username"):
        raise HTTPException(401, "Employee auth service returned an incomplete user")

    session_token = sign_user_session(user, settings)
    max_age = max(1, settings.auth_session_ttl_hours) * 3600
    response.set_cookie(
        COOKIE_NAME,
        session_token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return AuthStatus(auth_enabled=settings.auth_enabled, authenticated=True, user=AuthUser(**user))


@router.post("/logout", response_model=AuthStatus)
async def logout(response: Response, settings: SettingsDep) -> AuthStatus:
    response.delete_cookie(COOKIE_NAME, path="/")
    return AuthStatus(auth_enabled=settings.auth_enabled, authenticated=not settings.auth_enabled, user=None)
