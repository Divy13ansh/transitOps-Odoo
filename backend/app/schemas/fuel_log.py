from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date


class FuelLogCreate(BaseModel):
    vehicle_id: UUID
    trip_id: UUID | None = None
    liters: float = Field(..., gt=0)
    cost_per_liter: float = Field(..., gt=0)
    odometer_at_fill: float | None = None
    filled_at: date | None = None


class FuelLogResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    trip_id: UUID | None
    liters: float
    cost_per_liter: float
    total_cost: float
    odometer_at_fill: float | None
    filled_at: date
    created_at: datetime

    model_config = {"from_attributes": True}


class FuelLogListResponse(BaseModel):
    items: list[FuelLogResponse]
    total: int
    page: int
    page_size: int
    pages: int
