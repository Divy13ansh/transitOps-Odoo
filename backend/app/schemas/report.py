from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FuelEfficiencyItem(BaseModel):
    trip_id: UUID
    vehicle_id: UUID
    registration_number: str
    actual_distance_km: float
    total_liters: float
    km_per_liter: Optional[float] = None


class FleetUtilizationPoint(BaseModel):
    date: date
    vehicles_on_trip: int
    total_active_vehicles: int
    utilization_pct: float


class OperationalCostItem(BaseModel):
    vehicle_id: UUID
    registration_number: str
    name: str
    total_fuel_cost: float
    total_maintenance_cost: float
    total_operational_cost: float


class VehicleRoiItem(BaseModel):
    vehicle_id: UUID
    registration_number: str
    name: str
    acquisition_cost: float
    total_fuel_cost: float
    total_maintenance_cost: float
    total_operational_cost: float
    total_revenue: float
    roi: Optional[float] = None
