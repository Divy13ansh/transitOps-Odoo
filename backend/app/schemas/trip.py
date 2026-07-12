from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TripCreate(BaseModel):
    vehicle_id: UUID
    driver_id: UUID
    source: str = Field(..., min_length=1, max_length=200)
    destination: str = Field(..., min_length=1, max_length=200)
    planned_distance_km: float = Field(..., gt=0)
    cargo_weight_kg: float = Field(..., gt=0)
    revenue: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class TripUpdate(BaseModel):
    vehicle_id: Optional[UUID] = None
    driver_id: Optional[UUID] = None
    source: Optional[str] = Field(default=None, min_length=1, max_length=200)
    destination: Optional[str] = Field(default=None, min_length=1, max_length=200)
    planned_distance_km: Optional[float] = Field(default=None, gt=0)
    cargo_weight_kg: Optional[float] = Field(default=None, gt=0)
    revenue: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class TripCompleteRequest(BaseModel):
    actual_distance_km: float = Field(..., gt=0)
    final_odometer_km: float = Field(..., gt=0)


class TripCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class TripResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vehicle_id: UUID
    driver_id: UUID
    source: str
    destination: str
    planned_distance_km: float
    actual_distance_km: Optional[float] = None
    cargo_weight_kg: float
    revenue: float
    status: str
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class TripListResponse(BaseModel):
    items: list[TripResponse]
    total: int
    page: int
    page_size: int
    pages: int
