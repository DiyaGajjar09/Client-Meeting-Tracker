from typing import Any

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import logger


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        detail: Any | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail


class EntityNotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", detail: Any | None = None):
        super().__init__(
            message=message,
            code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class DuplicateEntityError(AppException):
    def __init__(self, message: str = "Resource already exists", detail: Any | None = None):
        super().__init__(
            message=message,
            code="DUPLICATE_ENTITY",
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )


class InvalidInputError(AppException):
    def __init__(self, message: str = "Invalid input provided", detail: Any | None = None):
        super().__init__(
            message=message,
            code="INVALID_INPUT",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


class UnsupportedMediaTypeError(AppException):
    def __init__(self, message: str = "Unsupported media type", detail: Any | None = None):
        super().__init__(
            message=message,
            code="UNSUPPORTED_MEDIA_TYPE",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=detail,
        )


class PayloadTooLargeError(AppException):
    def __init__(
        self,
        message: str = "Payload exceeds maximum allowed size",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="PAYLOAD_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=detail,
        )


class AuthenticationError(AppException):
    def __init__(
        self,
        message: str = "Authentication required. Please provide a valid Bearer token.",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )


class AuthorizationError(AppException):
    def __init__(
        self,
        message: str = "Access forbidden. Insufficient permissions.",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class RateLimitExceededError(AppException):
    def __init__(
        self,
        message: str = "Rate limit exceeded. Please wait before retrying.",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )


class DatabaseConnectionError(AppException):
    def __init__(self, message: str = "Database service unavailable", detail: Any | None = None):
        super().__init__(
            message=message,
            code="DATABASE_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


class AIProviderError(AppException):
    def __init__(
        self,
        message: str = "AI upstream provider error",
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="AI_PROVIDER_ERROR",
            status_code=status_code,
            detail=detail,
        )


class AIUnavailableError(AppException):
    def __init__(
        self,
        message: str = "AI provider is not configured or available",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="AI_UNAVAILABLE",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


class ExtractionValidationError(AppException):
    def __init__(
        self,
        message: str = "Extraction output failed schema validation",
        detail: Any | None = None,
    ):
        super().__init__(
            message=message,
            code="EXTRACTION_VALIDATION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning(f"Application error: {exc.code} - {exc.message} on path {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "code": exc.code,
            "detail": exc.detail or str(exc),
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.warning(f"Request validation error on path {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error in request parameters",
            "code": "VALIDATION_ERROR",
            "detail": jsonable_encoder(exc.errors()),
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled server error on path {request.url.path}: {type(exc).__name__}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "An unexpected server error occurred",
            "code": "INTERNAL_SERVER_ERROR",
            "detail": "Please contact support if this error persists.",
        },
    )
