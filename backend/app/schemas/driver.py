from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from app.models.driver import DriverStatus


class DriverCreate(BaseModel):
    full_name: str = Field(..., max_length=100)
    license_number: str = Field(..., max_length=50)
    license_category: str = Field(..., max_length=10)
    license_expiry: date
    contact_number: str = Field(..., max_length=20)
    safety_score: float = Field(default=10.0, ge=0, le=10)


class DriverUpdate(BaseModel):
    full_name: str | None = None
    license_number: str | None = None
    license_category: str | None = None
    license_expiry: date | None = None
    contact_number: str | None = None
    safety_score: float | None = Field(default=None, ge=0, le=10)
    status: DriverStatus | None = None


class DriverResponse(BaseModel):
    id: UUID
    full_name: str
    license_number: str
    license_category: str
    license_expiry: date
    contact_number: str
    safety_score: float
    status: DriverStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DriverListResponse(BaseModel):
    items: list[DriverResponse]
    total: int
    page: int
    page_size: int
    pages: int
