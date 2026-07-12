import math
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles, PaginationParams
from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.user import User
from app.schemas.maintenance_log import (
    MaintenanceCreate,
    MaintenanceUpdate,
    MaintenanceClose,
    MaintenanceResponse,
    MaintenanceListResponse,
)
from app.services.maintenance_service import create_maintenance, close_maintenance

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.get("/", response_model=MaintenanceListResponse)
async def list_maintenance(
    status: MaintenanceStatus | None = None,
    vehicle_id: UUID | None = None,
    sort_by: str = "created_at",
    sort_order: str = "asc",
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MaintenanceLog)
    count_stmt = select(func.count()).select_from(MaintenanceLog)

    if status:
        stmt = stmt.where(MaintenanceLog.status == status)
        count_stmt = count_stmt.where(MaintenanceLog.status == status)
    if vehicle_id:
        stmt = stmt.where(MaintenanceLog.vehicle_id == vehicle_id)
        count_stmt = count_stmt.where(MaintenanceLog.vehicle_id == vehicle_id)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    sort_col = getattr(MaintenanceLog, sort_by, MaintenanceLog.created_at)
    if sort_order == "desc":
        stmt = stmt.order_by(sort_col.desc())
    else:
        stmt = stmt.order_by(sort_col.asc())

    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return MaintenanceListResponse(
        items=[MaintenanceResponse.model_validate(l) for l in logs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/{log_id}", response_model=MaintenanceResponse)
async def get_maintenance(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    log = await db.get(MaintenanceLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return MaintenanceResponse.model_validate(log)


@router.post("/", response_model=MaintenanceResponse, status_code=201)
async def create_maintenance_record(
    payload: MaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "safety_officer"),
):
    log = await create_maintenance(
        vehicle_id=payload.vehicle_id,
        maintenance_type=payload.type,
        description=payload.description,
        cost=payload.cost,
        odometer_at_service=payload.odometer_at_service,
        scheduled_date=payload.scheduled_date,
        created_by=_user.id,
        db=db,
    )
    return MaintenanceResponse.model_validate(log)


@router.patch("/{log_id}", response_model=MaintenanceResponse)
async def update_maintenance(
    log_id: UUID,
    payload: MaintenanceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "safety_officer"),
):
    log = await db.get(MaintenanceLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    if log.status == MaintenanceStatus.closed:
        raise HTTPException(status_code=400, detail="Cannot update a closed maintenance record")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)
    return MaintenanceResponse.model_validate(log)


@router.post("/{log_id}/close", response_model=MaintenanceResponse)
async def close_maintenance_record(
    log_id: UUID,
    payload: MaintenanceClose,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "safety_officer"),
):
    log = await close_maintenance(
        log_id=log_id,
        completed_date=payload.completed_date,
        final_cost=payload.final_cost,
        db=db,
    )
    return MaintenanceResponse.model_validate(log)
