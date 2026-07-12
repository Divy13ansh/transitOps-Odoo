import math
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db, require_roles, PaginationParams
from app.core.security import decode_access_token
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.user import User
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
    VehicleListResponse,
    VehicleCostSummary,
)

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.get("/", response_model=VehicleListResponse)
async def list_vehicles(
    status: VehicleStatus | None = None,
    type: str | None = None,
    region: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "asc",
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Vehicle)
    count_stmt = select(func.count()).select_from(Vehicle)

    if status:
        stmt = stmt.where(Vehicle.status == status)
        count_stmt = count_stmt.where(Vehicle.status == status)
    if type:
        stmt = stmt.where(Vehicle.type == type)
        count_stmt = count_stmt.where(Vehicle.type == type)
    if region:
        stmt = stmt.where(Vehicle.region.ilike(f"%{region}%"))
        count_stmt = count_stmt.where(Vehicle.region.ilike(f"%{region}%"))
    if search:
        stmt = stmt.where(Vehicle.registration_number.ilike(f"%{search}%"))
        count_stmt = count_stmt.where(Vehicle.registration_number.ilike(f"%{search}%"))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    sort_col = getattr(Vehicle, sort_by, Vehicle.created_at)
    if sort_order == "desc":
        stmt = stmt.order_by(sort_col.desc())
    else:
        stmt = stmt.order_by(sort_col.asc())

    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    vehicles = result.scalars().all()

    return VehicleListResponse(
        items=[VehicleResponse.model_validate(v) for v in vehicles],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/available", response_model=list[VehicleResponse])
async def list_available_vehicles(
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("dispatcher", "fleet_manager"),
):
    result = await db.execute(
        select(Vehicle).where(Vehicle.status == VehicleStatus.available)
    )
    vehicles = result.scalars().all()
    return [VehicleResponse.model_validate(v) for v in vehicles]


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleResponse.model_validate(vehicle)


@router.get("/{vehicle_id}/cost-summary", response_model=VehicleCostSummary)
async def get_vehicle_cost_summary(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "financial_analyst"),
):
    from sqlalchemy import text

    result = await db.execute(
        text("SELECT * FROM vw_vehicle_cost_summary WHERE vehicle_id = :vid"),
        {"vid": str(vehicle_id)},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return VehicleCostSummary(**row)


@router.post("/", response_model=VehicleResponse, status_code=201)
async def create_vehicle(
    payload: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    vehicle = Vehicle(**payload.model_dump())
    db.add(vehicle)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # BR-01: Unique registration number
        raise HTTPException(
            status_code=409,
            detail=f"Vehicle with registration '{payload.registration_number}' already exists",
        )
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.patch("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vehicle, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Vehicle with registration '{vehicle.registration_number}' already exists",
        )
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.delete("/{vehicle_id}", response_model=VehicleResponse)
async def delete_vehicle(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Soft-delete: set status to retired, never hard delete
    vehicle.status = VehicleStatus.retired
    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)
