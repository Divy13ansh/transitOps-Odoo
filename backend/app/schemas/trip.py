from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from app.models.trip import TripStatus


class TripCreate(BaseModel):
    vehicle_id: UUID
    driver_id: UUID
    source: str = Field(..., max_length=200)
    destination: str = Field(..., max_length=200)
    planned_distance_km: float = Field(..., gt=0)
    cargo_weight_kg: float = Field(..., gt=0)
    revenue: float = Field(default=0.0, ge=0)
    notes: str | None = None


class TripUpdate(BaseModel):
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    source: str | None = None
    destination: str | None = None
    planned_distance_km: float | None = Field(default=None, gt=0)
    cargo_weight_kg: float | None = Field(default=None, gt=0)
    revenue: float | None = Field(default=None, ge=0)
    notes: str | None = None


class TripResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    driver_id: UUID
    source: str
    destination: str
    planned_distance_km: float
    actual_distance_km: float | None
    cargo_weight_kg: float
    revenue: float
    status: TripStatus
    dispatched_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    notes: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripListResponse(BaseModel):
    items: list[TripResponse]
    total: int
    page: int
    page_size: int
    pages: int


class DispatchSuggestRequest(BaseModel):
    source: str = Field(..., max_length=200)
    destination: str = Field(..., max_length=200)
    cargo_weight_kg: float = Field(..., gt=0)
    planned_distance_km: float = Field(..., gt=0)


class DispatchSuggestionItem(BaseModel):
    rank: int
    vehicle_id: UUID
    vehicle_name: str
    driver_id: UUID
    driver_name: str
    reason: str


class DispatchSuggestResponse(BaseModel):
    suggestions: list[DispatchSuggestionItem]
    excluded: str | None = None
