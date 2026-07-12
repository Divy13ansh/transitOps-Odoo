from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from app.models.maintenance_log import MaintenanceStatus


class MaintenanceCreate(BaseModel):
    vehicle_id: UUID
    type: str = Field(..., max_length=100)
    description: str | None = None
    cost: float = Field(default=0.0, ge=0)
    odometer_at_service: float | None = None
    scheduled_date: date | None = None


class MaintenanceUpdate(BaseModel):
    type: str | None = None
    description: str | None = None
    cost: float | None = Field(default=None, ge=0)
    odometer_at_service: float | None = None
    scheduled_date: date | None = None


class MaintenanceClose(BaseModel):
    completed_date: date
    final_cost: float | None = Field(default=None, ge=0)


class MaintenanceResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    type: str
    description: str | None
    cost: float
    odometer_at_service: float | None
    status: MaintenanceStatus
    scheduled_date: date | None
    completed_date: date | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceListResponse(BaseModel):
    items: list[MaintenanceResponse]
    total: int
    page: int
    page_size: int
    pages: int
