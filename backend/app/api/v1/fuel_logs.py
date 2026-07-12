import math
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles, PaginationParams
from app.models.fuel_log import FuelLog
from app.models.user import User
from app.schemas.fuel_log import (
    FuelLogCreate,
    FuelLogResponse,
    FuelLogListResponse,
)

router = APIRouter(prefix="/fuel-logs", tags=["Fuel Logs"])


@router.get("/", response_model=FuelLogListResponse)
async def list_fuel_logs(
    vehicle_id: UUID | None = None,
    trip_id: UUID | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher", "financial_analyst"),
):
    stmt = select(FuelLog)
    count_stmt = select(func.count()).select_from(FuelLog)

    if vehicle_id:
        stmt = stmt.where(FuelLog.vehicle_id == vehicle_id)
        count_stmt = count_stmt.where(FuelLog.vehicle_id == vehicle_id)
    if trip_id:
        stmt = stmt.where(FuelLog.trip_id == trip_id)
        count_stmt = count_stmt.where(FuelLog.trip_id == trip_id)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    stmt = stmt.order_by(FuelLog.created_at.desc())
    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return FuelLogListResponse(
        items=[FuelLogResponse.model_validate(l) for l in logs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/{log_id}", response_model=FuelLogResponse)
async def get_fuel_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    log = await db.get(FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Fuel log not found")
    return FuelLogResponse.model_validate(log)


@router.post("/", response_model=FuelLogResponse, status_code=201)
async def create_fuel_log(
    payload: FuelLogCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    # total_cost is a PostgreSQL generated column — never set in app code
    log = FuelLog(**payload.model_dump())
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return FuelLogResponse.model_validate(log)


@router.delete("/{log_id}", status_code=204)
async def delete_fuel_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    log = await db.get(FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    # Hard delete — correction action restricted to fleet_manager
    await db.delete(log)
    await db.commit()
    return None
