from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.clients import router as clients_router
from app.api.routes.health import router as health_router
from app.api.routes.items import router as items_router
from app.api.routes.meetings import router as meetings_router
from app.core.auth import require_auth
from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    validation_exception_handler,
)
from app.core.logging import logger
from app.core.middleware import (
    CorrelationIdMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown event management."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.APP_ENV}]")
    logger.info(f"Configured MySQL target: {settings.get_safe_database_url_str()}")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend REST API for Client Meeting-to-Action Tracker with MySQL persistence.",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Operational & Security Middlewares (evaluated in order of registration)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Configure CORS for React.js + Vite development servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Request-ID"],
)

# Register custom exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount Public Unauthenticated Routes
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api/v1")

# Mount Protected Business Routes (require valid workspace Bearer token)
app.include_router(clients_router, dependencies=[Depends(require_auth)])
app.include_router(meetings_router, dependencies=[Depends(require_auth)])
app.include_router(items_router, dependencies=[Depends(require_auth)])

# Mount same routes under /api/v1 for versioned client consumers
app.include_router(clients_router, prefix="/api/v1", dependencies=[Depends(require_auth)])
app.include_router(meetings_router, prefix="/api/v1", dependencies=[Depends(require_auth)])
app.include_router(items_router, prefix="/api/v1", dependencies=[Depends(require_auth)])


@app.get("/", tags=["Root"])
def root_info():
    """Root endpoint welcoming developers to the API."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs_url": "/docs" if settings.DEBUG else None,
        "health_url": "/health",
        "auth_policy": "v1.0 workspace shared password or hosting SSO",
    }
