from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from app.models.vehicle import VehicleStatus


class VehicleCreate(BaseModel):
    registration_number: str = Field(..., max_length=20)
    name: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    max_load_kg: float = Field(..., gt=0)
    odometer_km: float = Field(default=0.0, ge=0)
    acquisition_cost: float = Field(default=0.0, ge=0)
    region: str | None = None


class VehicleUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    max_load_kg: float | None = Field(default=None, gt=0)
    odometer_km: float | None = Field(default=None, ge=0)
    acquisition_cost: float | None = Field(default=None, ge=0)
    status: VehicleStatus | None = None
    region: str | None = None


class VehicleResponse(BaseModel):
    id: UUID
    registration_number: str
    name: str
    type: str
    max_load_kg: float
    odometer_km: float
    acquisition_cost: float
    status: VehicleStatus
    region: str | None
    lat: float | None = None
    lng: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VehicleListResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
    page: int
    page_size: int
    pages: int


class VehicleCostSummary(BaseModel):
    vehicle_id: UUID
    registration_number: str
    name: str
    acquisition_cost: float
    total_fuel_cost: float
    total_maintenance_cost: float
    total_operational_cost: float
    total_revenue: float
    roi: float | None

    model_config = {"from_attributes": True}
