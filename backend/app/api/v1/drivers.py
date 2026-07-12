import math
from uuid import UUID
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.deps import get_db, require_roles, PaginationParams
from app.models.driver import Driver, DriverStatus
from app.models.user import User
from app.schemas.driver import (
    DriverCreate,
    DriverUpdate,
    DriverResponse,
    DriverListResponse,
)

router = APIRouter(prefix="/drivers", tags=["Drivers"])


@router.get("/", response_model=DriverListResponse)
async def list_drivers(
    status: DriverStatus | None = None,
    license_category: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "asc",
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Driver)
    count_stmt = select(func.count()).select_from(Driver)

    if status:
        stmt = stmt.where(Driver.status == status)
        count_stmt = count_stmt.where(Driver.status == status)
    if license_category:
        stmt = stmt.where(Driver.license_category == license_category)
        count_stmt = count_stmt.where(Driver.license_category == license_category)
    if search:
        stmt = stmt.where(Driver.full_name.ilike(f"%{search}%"))
        count_stmt = count_stmt.where(Driver.full_name.ilike(f"%{search}%"))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    sort_col = getattr(Driver, sort_by, Driver.created_at)
    if sort_order == "desc":
        stmt = stmt.order_by(sort_col.desc())
    else:
        stmt = stmt.order_by(sort_col.asc())

    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    drivers = result.scalars().all()

    return DriverListResponse(
        items=[DriverResponse.model_validate(d) for d in drivers],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/available", response_model=list[DriverResponse])
async def list_available_drivers(
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("dispatcher", "fleet_manager"),
):
    today = date.today()
    result = await db.execute(
        select(Driver).where(
            Driver.status == DriverStatus.available,
            Driver.license_expiry >= today,
        )
    )
    drivers = result.scalars().all()
    return [DriverResponse.model_validate(d) for d in drivers]


@router.get("/expiring-licenses", response_model=list[DriverResponse])
async def list_expiring_licenses(
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("safety_officer", "fleet_manager"),
):
    today = date.today()
    thirty_days = today + timedelta(days=30)
    result = await db.execute(
        select(Driver).where(
            Driver.license_expiry.between(today, thirty_days)
        )
    )
    drivers = result.scalars().all()
    return [DriverResponse.model_validate(d) for d in drivers]


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    driver = await db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    return DriverResponse.model_validate(driver)


@router.post("/", response_model=DriverResponse, status_code=201)
async def create_driver(
    payload: DriverCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "safety_officer"),
):
    driver = Driver(**payload.model_dump())
    db.add(driver)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Driver with license number '{payload.license_number}' already exists",
        )
    await db.refresh(driver)
    return DriverResponse.model_validate(driver)


@router.patch("/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: UUID,
    payload: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "safety_officer"),
):
    driver = await db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(driver, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Driver with license number '{driver.license_number}' already exists",
        )
    await db.refresh(driver)
    return DriverResponse.model_validate(driver)


@router.delete("/{driver_id}", response_model=DriverResponse)
async def delete_driver(
    driver_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager"),
):
    driver = await db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Suspend: never hard delete
    driver.status = DriverStatus.suspended
    await db.commit()
    await db.refresh(driver)
    return DriverResponse.model_validate(driver)
