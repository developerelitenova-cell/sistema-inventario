from .auth import router as auth_router
from .users import router as users_router
from .warehouses import router as warehouses_router
from .assets import router as assets_router
from .loans import router as loans_router
from .assignments import router as assignments_router
from .requests import router as requests_router
from .audit import router as audit_router

__all__ = [
    "auth_router",
    "users_router",
    "warehouses_router",
    "assets_router",
    "loans_router",
    "assignments_router",
    "requests_router",
    "audit_router",
]
