import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.schemas.trip import (
    TripCancelRequest,
    TripCompleteRequest,
    TripCreate,
    TripListResponse,
    TripResponse,
    TripUpdate,
)
from app.services import trip_service

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=TripListResponse)
async def list_trips_endpoint(
    status: Optional[str] = Query(default=None),
    vehicle_id: Optional[UUID] = Query(default=None),
    driver_id: Optional[UUID] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trips, total = await trip_service.list_trips(
        db, status=status, vehicle_id=vehicle_id, driver_id=driver_id, page=page, page_size=page_size
    )
    pages = math.ceil(total / page_size) if page_size else 1
    return TripListResponse(
        items=[TripResponse.model_validate(t) for t in trips],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=TripResponse,
    status_code=201,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def create_trip_endpoint(
    trip_data: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.create_trip(db, trip_data, created_by=current_user.id)
    return TripResponse.model_validate(trip)


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip_endpoint(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.get_trip(db, trip_id)
    return TripResponse.model_validate(trip)


@router.patch(
    "/{trip_id}",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def update_trip_endpoint(
    trip_id: UUID,
    trip_data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.update_trip_draft(db, trip_id, trip_data)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/dispatch",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def dispatch_trip_endpoint(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.dispatch_trip(db, trip_id)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/complete",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def complete_trip_endpoint(
    trip_id: UUID,
    data: TripCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.complete_trip(db, trip_id, data)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/cancel",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def cancel_trip_endpoint(
    trip_id: UUID,
    data: TripCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.cancel_trip(db, trip_id, data)
    return TripResponse.model_validate(trip)
