from app.db.base import Base
from app.models.role import Role
from app.models.user import User
from app.models.depot import Depot
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.maintenance_log import MaintenanceLog
from app.models.fuel_log import FuelLog
from app.models.expense import Expense
from app.models.briefing_cache import BriefingCache
from app.models.dispatch_suggestion import DispatchSuggestion

# Expose enums at the package level for teammate's router/service compatibility
from app.models.enums import (
    VehicleStatus,
    DriverStatus,
    TripStatus,
    MaintenanceStatus,
    ExpenseCategory
)

__all__ = [
    "Base",
    "Role",
    "User",
    "Depot",
    "Vehicle",
    "VehicleStatus",
    "Driver",
    "DriverStatus",
    "Trip",
    "TripStatus",
    "MaintenanceLog",
    "MaintenanceStatus",
    "FuelLog",
    "Expense",
    "ExpenseCategory",
    "BriefingCache",
    "DispatchSuggestion",
]
