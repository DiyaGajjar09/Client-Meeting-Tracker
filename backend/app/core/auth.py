"""Authentication and access control for Client Meeting-to-Action Tracker.

PRD v1.0 specifies a single shared password or company SSO at the hosting layer.
This module implements application-level token authentication, HMAC-SHA256 signed session
tokens, and route protection for confidential meeting records and exports.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Depends, Header, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.exceptions import AuthenticationError

# Optional HTTPBearer to enable Swagger UI Authorize button
security_scheme = HTTPBearer(auto_error=False)


def _b64_encode(data: bytes) -> str:
    """URL-safe base64 encoding without trailing padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    """URL-safe base64 decoding with restored padding."""
    padding = 4 - (len(data) % 4)
    if padding < 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(
    subject: str = "workspace_member",
    expires_minutes: int | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Generate a cryptographically signed HMAC-SHA256 session token."""
    expire_delta = (expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES) * 60
    now = int(time.time())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expire_delta,
    }
    if extra_claims:
        payload.update(extra_claims)

    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64_encode(payload_bytes)

    # Calculate HMAC-SHA256 signature
    secret = settings.API_SECRET_KEY.encode("utf-8")
    signature = hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()

    return f"{payload_b64}.{signature}"


def verify_access_token(token: str) -> dict[str, Any] | None:
    """Verify HMAC signature and expiration timestamp of an access token."""
    if not token or "." not in token:
        return None

    try:
        payload_b64, signature = token.strip().rsplit(".", 1)
        secret = settings.API_SECRET_KEY.encode("utf-8")
        expected_sig = hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()

        # Constant-time comparison prevents timing attacks
        if not hmac.compare_digest(signature, expected_sig):
            return None

        payload_bytes = _b64_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify token expiration
        exp = payload.get("exp")
        if not exp or int(exp) < int(time.time()):
            return None

        return payload
    except Exception:
        return None


def verify_shared_password(password: str) -> bool:
    """Verify if the provided password matches the configured workspace shared password."""
    if not password:
        return False
    # Constant-time string comparison
    return hmac.compare_digest(password.strip(), settings.APP_SHARED_PASSWORD.strip())


async def require_auth(
    bearer: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    token_query: str | None = Query(None, alias="token"),
) -> dict[str, Any]:
    """FastAPI dependency protecting sensitive meeting and client routes.

    Checks Bearer token header, X-API-Key header, or token query param.
    When AUTH_ENABLED is False (e.g. for simple local development or tests),
    permits access as dev_user.
    """
    if not settings.AUTH_ENABLED:
        return {"sub": "dev_user", "role": "admin", "authenticated": True}

    token = None
    if bearer and bearer.credentials:
        token = bearer.credentials
    elif x_api_key:
        token = x_api_key
    elif token_query:
        token = token_query

    if not token:
        raise AuthenticationError(
            "Authentication required. Please supply a valid Bearer token in the Authorization header."
        )

    claims = verify_access_token(token)
    if not claims:
        raise AuthenticationError("Invalid or expired session token. Please re-authenticate.")

    return claims

