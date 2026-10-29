"""Security and operational middlewares for production readiness."""

from __future__ import annotations

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject defensive HTTP response security headers."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Basic security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # HTTP Strict Transport Security in production environments
        if settings.APP_ENV.lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized payloads before loading them into memory to prevent memory exhaustion."""

    def __init__(self, app, max_upload_bytes: int | None = None):
        super().__init__(app)
        # Maximum allowed content length (e.g., 10MB file + 2MB form metadata)
        self.max_bytes = max_upload_bytes or (settings.MAX_UPLOAD_BYTES + 2097152)

    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > self.max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": f"Request body exceeds maximum allowed limit of {self.max_bytes // 1048576} MB.",
                            "code": "PAYLOAD_TOO_LARGE",
                            "detail": f"Content-Length: {length} bytes",
                        },
                    )
            except ValueError:
                pass

        return await call_next(request)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Propagate or generate X-Request-ID for distributed tracing and secure logging."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
