"""Authentication endpoints supporting v1.0 workspace shared access and session management."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.core.auth import create_access_token, require_auth, verify_shared_password
from app.core.config import settings
from app.core.exceptions import AuthenticationError
from app.core.rate_limit import rate_limit

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """Payload to authenticate against the workspace access policy."""

    password: str = Field(..., description="Shared workspace password")
    email: str | None = Field(None, description="Optional member email address")

    model_config = ConfigDict(extra="ignore")


class LoginResponse(BaseModel):
    """Token and member profile returned upon successful authentication."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict[str, Any]


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate Workspace Access",
    dependencies=[Depends(rate_limit("auth_login", lambda: settings.RATE_LIMIT_LOGIN))],
)
def login(payload: LoginRequest):
    """Validate workspace shared password and issue a signed session Bearer token."""
    if not verify_shared_password(payload.password):
        raise AuthenticationError("Invalid workspace access password. Check your organization credentials.")

    member_email = payload.email.strip() if payload.email else "member@workspace.local"
    member_name = member_email.split("@")[0].replace(".", " ").title()

    token = create_access_token(
        subject=member_email,
        extra_claims={
            "name": member_name,
            "role": "workspace_member",
        },
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "name": member_name,
            "email": member_email,
            "role": "workspace_member",
        },
    }


@router.get("/verify", summary="Verify Active Session")
def verify_session(claims: dict[str, Any] = Depends(require_auth)):
    """Check validity of current authentication token."""
    return {
        "status": "authenticated",
        "subject": claims.get("sub"),
        "role": claims.get("role", "member"),
        "expires_at": claims.get("exp"),
    }


@router.post("/logout", summary="Invalidate Client Session")
def logout():
    """Client logout confirmation."""
    return {"message": "Session terminated successfully."}
