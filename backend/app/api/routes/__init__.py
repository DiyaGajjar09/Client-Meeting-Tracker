from app.api.routes.clients import router as clients_router
from app.api.routes.health import router as health_router
from app.api.routes.items import router as items_router
from app.api.routes.meetings import router as meetings_router

__all__ = ["clients_router", "health_router", "meetings_router", "items_router"]
