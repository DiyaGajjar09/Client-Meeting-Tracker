"""Automated security, access control, and production hardening tests."""

import io
import zipfile
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.auth import create_access_token, require_auth, verify_access_token
from app.core.config import settings
from app.core.exceptions import PayloadTooLargeError
from app.core.rate_limit import limiter
from app.db.models import MeetingModel
from app.db.session import get_db
from app.ingestion.parsers import extract_text_from_docx
from app.main import app
from app.services.meeting_service import MeetingService


def test_auth_token_generation_and_verification():
    """Verify HMAC-SHA256 token creation, signature validation, and expiration."""
    token = create_access_token(subject="user@company.com", expires_minutes=60)
    assert token is not None
    assert "." in token

    claims = verify_access_token(token)
    assert claims is not None
    assert claims["sub"] == "user@company.com"
    assert claims["exp"] > claims["iat"]

    # Tampered token must fail verification
    tampered_token = token[:-4] + "abcd"
    assert verify_access_token(tampered_token) is None

    # Expired token must fail verification
    expired_token = create_access_token(subject="user@company.com", expires_minutes=-10)
    assert verify_access_token(expired_token) is None


def test_auth_login_endpoint():
    """Verify /auth/login issues valid session tokens for correct shared password."""
    client = TestClient(app)

    # Valid password
    res_ok = client.post(
        "/auth/login",
        json={"password": settings.APP_SHARED_PASSWORD, "email": "analyst@company.com"},
    )
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "analyst@company.com"

    # Invalid password returns 401
    res_bad = client.post(
        "/auth/login",
        json={"password": "wrong_password_xyz", "email": "analyst@company.com"},
    )
    assert res_bad.status_code == 401
    assert "Invalid workspace access password" in res_bad.json()["error"]


def test_unauthenticated_request_rejected():
    """Verify sensitive endpoints return HTTP 401 Unauthorized when token is missing or invalid."""
    # Ensure no auth override is active
    app.dependency_overrides.pop(require_auth, None)
    client = TestClient(app)

    # 1. GET /meetings without token -> 401
    res_unauth = client.get("/meetings")
    assert res_unauth.status_code == 401
    assert "Authentication required" in res_unauth.json()["error"]

    # 2. GET /meetings with bogus token -> 401
    res_bogus = client.get(
        "/meetings",
        headers={"Authorization": "Bearer invalid.bogus.token"},
    )
    assert res_bogus.status_code == 401

    # 3. Public endpoints remain accessible without token
    res_health = client.get("/health")
    assert res_health.status_code in (200, 503)

    res_root = client.get("/")
    assert res_root.status_code == 200


def test_authenticated_request_accepted():
    """Verify valid Bearer token grants access to protected routes."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.all.return_value = []
    mock_db.scalar.return_value = 0

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides.pop(require_auth, None)
    client = TestClient(app)

    try:
        valid_token = create_access_token(subject="auditor@company.com")
        res = client.get(
            "/meetings",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert res.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_security_headers_present():
    """Verify defensive HTTP response security headers on all endpoints."""
    client = TestClient(app)
    response = client.get("/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "x-request-id" in response.headers


def test_request_size_limit_rejection():
    """Verify RequestSizeLimitMiddleware immediately rejects oversized Content-Length."""
    client = TestClient(app)
    # Exceeds 10MB + 2MB threshold
    huge_length = str(20 * 1024 * 1024)

    response = client.post(
        "/meetings",
        headers={"content-length": huge_length, "Content-Type": "application/json"},
        content=b"{}",
    )
    assert response.status_code == 413
    assert response.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_rate_limiting_enforcement():
    """Verify SlidingWindowRateLimiter rejects rapid requests exceeding operation quota."""
    limiter.clear()
    client = TestClient(app)

    # settings.RATE_LIMIT_LOGIN is 10 requests per minute
    limit = settings.RATE_LIMIT_LOGIN

    # First N requests succeed or return expected auth error
    for _ in range(limit):
        res = client.post("/auth/login", json={"password": "bad"})
        assert res.status_code == 401

    # (N+1)-th request must be throttled with HTTP 429
    res_throttled = client.post("/auth/login", json={"password": "bad"})
    assert res_throttled.status_code == 429
    assert res_throttled.json()["code"] == "RATE_LIMIT_EXCEEDED"

    limiter.clear()


def test_docx_decompression_bomb_rejected():
    """Verify DOCX parser inspects ZIP entries and blocks excessive expansion ratios."""
    # Craft an in-memory ZIP bomb with abnormal uncompressed size
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # 100KB of zeros compresses down to ~100 bytes (high expansion ratio > 100:1)
        zero_payload = b"\x00" * (200 * 1024)
        zf.writestr("word/document.xml", zero_payload)

    bio.seek(0)
    bomb_bytes = bio.getvalue()

    with pytest.raises(PayloadTooLargeError) as exc_info:
        extract_text_from_docx(bomb_bytes)
    assert "decompression bomb" in str(exc_info.value).lower() or "expansion" in str(exc_info.value).lower()


def test_health_endpoint_zero_secret_leakage():
    """Verify /health endpoint never leaks database passwords, host credentials, or Gemini keys."""
    client = TestClient(app)
    res = client.get("/health")
    data = res.json()

    # Convert entire JSON to string to check for accidental secret inclusion
    raw_response_str = str(data)

    assert settings.DB_PASSWORD not in raw_response_str
    if settings.GEMINI_API_KEY:
        assert settings.GEMINI_API_KEY not in raw_response_str
    assert settings.API_SECRET_KEY not in raw_response_str
    assert settings.APP_SHARED_PASSWORD not in raw_response_str


def test_data_retention_cleanup_logic():
    """Verify cleanup_expired_meetings identifies and purges meetings older than retention window."""
    mock_db = MagicMock()

    # Expired meeting created 100 days ago
    expired_meeting = MeetingModel(
        id="m-old",
        client_id="c1",
        title="Old Meeting 2025",
        created_at=datetime.now(UTC) - timedelta(days=100),
        raw_text="Old notes",
    )
    mock_db.scalars.return_value.all.return_value = [expired_meeting]

    deleted_count = MeetingService.cleanup_expired_meetings(mock_db, retention_days=90)
    assert deleted_count == 1
    mock_db.delete.assert_called_once_with(expired_meeting)
    mock_db.commit.assert_called_once()
