import math
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles, PaginationParams
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseListResponse,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("/", response_model=ExpenseListResponse)
async def list_expenses(
    vehicle_id: UUID | None = None,
    trip_id: UUID | None = None,
    category: str | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher", "financial_analyst"),
):
    stmt = select(Expense)
    count_stmt = select(func.count()).select_from(Expense)

    if vehicle_id:
        stmt = stmt.where(Expense.vehicle_id == vehicle_id)
        count_stmt = count_stmt.where(Expense.vehicle_id == vehicle_id)
    if trip_id:
        stmt = stmt.where(Expense.trip_id == trip_id)
        count_stmt = count_stmt.where(Expense.trip_id == trip_id)
    if category:
        stmt = stmt.where(Expense.category == category)
        count_stmt = count_stmt.where(Expense.category == category)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    stmt = stmt.order_by(Expense.created_at.desc())
    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    expenses = result.scalars().all()

    return ExpenseListResponse(
        items=[ExpenseResponse.model_validate(e) for e in expenses],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    expense = await db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return ExpenseResponse.model_validate(expense)


@router.post("/", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    expense = Expense(
        **payload.model_dump(),
        created_by=_user.id,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return ExpenseResponse.model_validate(expense)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    expense = await db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Hard delete — correction action restricted to fleet_manager
    await db.delete(expense)
    await db.commit()
    return None
