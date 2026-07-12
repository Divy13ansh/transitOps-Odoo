from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1 import (
    vehicles,
    drivers,
    trips,
    maintenance,
    fuel_logs,
    expenses,
    dashboard,
    chat,
    autopilot,
    reports
)

api_router = APIRouter()

# Include fully implemented auth router
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

# Include teammate's routers
api_router.include_router(vehicles.router)
api_router.include_router(drivers.router)
api_router.include_router(trips.router)
api_router.include_router(maintenance.router)
api_router.include_router(fuel_logs.router)
api_router.include_router(expenses.router)
api_router.include_router(dashboard.router)
api_router.include_router(chat.router)
api_router.include_router(autopilot.router)
api_router.include_router(reports.router)
