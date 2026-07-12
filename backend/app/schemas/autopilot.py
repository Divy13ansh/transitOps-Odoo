from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class AutopilotToggleRequest(BaseModel):
    enabled: bool


class AutopilotToggleResponse(BaseModel):
    enabled: bool
    message: str


class AutopilotEvent(BaseModel):
    id: str
    timestamp: datetime
    event_type: str  # "auto_dispatched", "escalated", "no_candidates", "error"
    trip_id: UUID | None = None
    vehicle_id: UUID | None = None
    vehicle_name: str | None = None
    driver_id: UUID | None = None
    driver_name: str | None = None
    reason: str
    status: str  # "dispatched", "pending", "rejected"


class AutopilotFeedResponse(BaseModel):
    events: list[AutopilotEvent]
    autopilot_enabled: bool
    total_dispatched: int
    total_escalated: int
