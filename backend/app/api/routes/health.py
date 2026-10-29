from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.db.session import check_db_connection

router = APIRouter(tags=["Health"])


@router.get("/health", summary="System Health and Database Connectivity Check")
def get_health(response: Response):
    """Check application status and MySQL connectivity.

    Does not require an LLM API key. Returns 503 when the database is unavailable.
    """
    db_connected = check_db_connection()

    if not db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        app_status = "degraded"
    else:
        app_status = "healthy"

    return {
        "status": app_status,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "database": {
            "engine": "mysql",
            "connected": db_connected,
        },
    }
