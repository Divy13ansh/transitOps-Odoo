from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from app.models.expense import ExpenseCategory


class ExpenseCreate(BaseModel):
    vehicle_id: UUID
    trip_id: UUID | None = None
    category: ExpenseCategory
    amount: float = Field(..., gt=0)
    description: str | None = None
    expense_date: date | None = None


class ExpenseResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    trip_id: UUID | None
    category: ExpenseCategory
    amount: float
    description: str | None
    expense_date: date
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseListResponse(BaseModel):
    items: list[ExpenseResponse]
    total: int
    page: int
    page_size: int
    pages: int
