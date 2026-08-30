import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from pwdlib import PasswordHash

from .config import Settings, get_settings

password_hash = PasswordHash.recommended()
COOKIE_NAME = "fintrack_session"
CSRF_COOKIE_NAME = "fintrack_csrf"


def verify_password(password: str, settings: Settings) -> bool:
    try:
        return password_hash.verify(password, settings.owner_password_hash)
    except Exception:
        return False


def create_session(settings: Settings) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    csrf = secrets.token_urlsafe(32)
    token = jwt.encode(
        {"sub": "owner", "csrf": csrf, "iat": now, "exp": now + timedelta(hours=settings.app.session_hours)},
        settings.session_signing_key,
        algorithm="HS256",
    )
    return token, csrf


def session_claims(token: str | None, settings: Settings) -> dict:
    try:
        payload = jwt.decode(token or "", settings.session_signing_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    if payload.get("sub") != "owner" or not isinstance(payload.get("csrf"), str):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return payload


def require_owner(token: str | None = Cookie(None, alias=COOKIE_NAME), settings: Settings = Depends(get_settings)) -> str:
    session_claims(token, settings)
    return "owner"


async def validate_origin(request: Request, settings: Settings = Depends(get_settings)) -> None:
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != str(settings.app.frontend_url).rstrip("/"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid origin")


async def require_csrf(
    request: Request,
    token: str | None = Cookie(None, alias=COOKIE_NAME),
    csrf_cookie: str | None = Cookie(None, alias=CSRF_COOKIE_NAME),
    csrf_header: str | None = Header(None, alias="X-CSRF-Token"),
    settings: Settings = Depends(get_settings),
) -> None:
    await validate_origin(request, settings)
    claim = session_claims(token, settings).get("csrf", "")
    if not csrf_cookie or not csrf_header or not hmac.compare_digest(claim, csrf_cookie) or not hmac.compare_digest(claim, csrf_header):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF validation failed")
