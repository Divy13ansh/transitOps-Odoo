from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.driver import Driver
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.enums import VehicleStatus, DriverStatus, TripStatus
from app.schemas.trip import TripCancelRequest, TripCompleteRequest, TripCreate, TripUpdate


async def _get_trip_or_404(db: AsyncSession, trip_id: UUID) -> Trip:
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")
    return trip


async def _get_vehicle_or_404(db: AsyncSession, vehicle_id: UUID) -> Vehicle:
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found")
    return vehicle


async def _get_driver_or_404(db: AsyncSession, driver_id: UUID) -> Driver:
    result = await db.execute(select(Driver).where(Driver.id == driver_id))
    driver = result.scalar_one_or_none()
    if driver is None:
        raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found")
    return driver


async def _commit_or_rollback(db: AsyncSession) -> None:
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise


async def create_trip(db: AsyncSession, trip_data: TripCreate, created_by: UUID) -> Trip:
    vehicle = await _get_vehicle_or_404(db, trip_data.vehicle_id)
    await _get_driver_or_404(db, trip_data.driver_id)

    max_load = float(vehicle.max_load_kg)
    if trip_data.cargo_weight_kg > max_load:
        raise HTTPException(
            status_code=400,
            detail=f"Cargo {trip_data.cargo_weight_kg} kg exceeds vehicle max capacity {max_load} kg",
        )

    trip = Trip(
        vehicle_id=trip_data.vehicle_id,
        driver_id=trip_data.driver_id,
        source=trip_data.source,
        destination=trip_data.destination,
        planned_distance_km=Decimal(str(trip_data.planned_distance_km)),
        cargo_weight_kg=Decimal(str(trip_data.cargo_weight_kg)),
        revenue=Decimal(str(trip_data.revenue)),
        notes=trip_data.notes,
        status=TripStatus.draft,
        created_by=created_by,
    )
    db.add(trip)
    await _commit_or_rollback(db)
    await db.refresh(trip)
    return trip


async def get_trip(db: AsyncSession, trip_id: UUID) -> Trip:
    return await _get_trip_or_404(db, trip_id)


async def list_trips(
    db: AsyncSession,
    status: Optional[str] = None,
    vehicle_id: Optional[UUID] = None,
    driver_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Trip], int]:
    query = select(Trip)
    count_query = select(func.count()).select_from(Trip)

    if status is not None:
        trip_status_val = TripStatus(status)
        query = query.where(Trip.status == trip_status_val)
        count_query = count_query.where(Trip.status == trip_status_val)
    if vehicle_id is not None:
        query = query.where(Trip.vehicle_id == vehicle_id)
        count_query = count_query.where(Trip.vehicle_id == vehicle_id)
    if driver_id is not None:
        query = query.where(Trip.driver_id == driver_id)
        count_query = count_query.where(Trip.driver_id == driver_id)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Trip.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    trips = (await db.execute(query)).scalars().all()
    return list(trips), total


async def update_trip_draft(db: AsyncSession, trip_id: UUID, trip_data: TripUpdate) -> Trip:
    trip = await _get_trip_or_404(db, trip_id)
    if trip.status != TripStatus.draft:
        raise HTTPException(
            status_code=400,
            detail=f"Trip can only be updated while in draft status (current status: {trip.status.value})",
        )

    update_fields = trip_data.model_dump(exclude_unset=True)

    if "driver_id" in update_fields:
        await _get_driver_or_404(db, update_fields["driver_id"])

    if "vehicle_id" in update_fields or "cargo_weight_kg" in update_fields:
        target_vehicle_id = update_fields.get("vehicle_id", trip.vehicle_id)
        target_cargo = update_fields.get("cargo_weight_kg", float(trip.cargo_weight_kg))
        vehicle = await _get_vehicle_or_404(db, target_vehicle_id)
        max_load = float(vehicle.max_load_kg)
        if target_cargo > max_load:
            raise HTTPException(
                status_code=400,
                detail=f"Cargo {target_cargo} kg exceeds vehicle max capacity {max_load} kg",
            )

    for field, value in update_fields.items():
        if field in ("planned_distance_km", "cargo_weight_kg", "revenue") and value is not None:
            setattr(trip, field, Decimal(str(value)))
        else:
            setattr(trip, field, value)

    await _commit_or_rollback(db)
    await db.refresh(trip)
    return trip


async def dispatch_trip(db: AsyncSession, trip_id: UUID) -> Trip:
    trip = await _get_trip_or_404(db, trip_id)
    if trip.status != TripStatus.draft:
        raise HTTPException(
            status_code=400,
            detail=f"Trip must be in draft status to dispatch (current status: {trip.status.value})",
        )

    vehicle = await _get_vehicle_or_404(db, trip.vehicle_id)
    driver = await _get_driver_or_404(db, trip.driver_id)

    if vehicle.status != VehicleStatus.available:
        raise HTTPException(
            status_code=400,
            detail=f"Vehicle {vehicle.registration_number} is not available for dispatch (current status: {vehicle.status.value})",
        )

    if driver.status != DriverStatus.available:
        raise HTTPException(
            status_code=400,
            detail=f"Driver {driver.full_name} cannot be assigned (current status: {driver.status.value})",
        )

    if driver.license_expiry < date.today():
        raise HTTPException(
            status_code=400,
            detail=f"Driver {driver.full_name} license expired on {driver.license_expiry}",
        )

    now = datetime.now(timezone.utc)
    trip.status = TripStatus.dispatched
    trip.dispatched_at = now
    vehicle.status = VehicleStatus.on_trip
    driver.status = DriverStatus.on_trip

    await _commit_or_rollback(db)
    await db.refresh(trip)
    return trip


async def complete_trip(db: AsyncSession, trip_id: UUID, data: TripCompleteRequest) -> Trip:
    trip = await _get_trip_or_404(db, trip_id)
    if trip.status != TripStatus.dispatched:
        raise HTTPException(
            status_code=400,
            detail=f"Trip must be dispatched to complete (current status: {trip.status.value})",
        )

    vehicle = await _get_vehicle_or_404(db, trip.vehicle_id)
    driver = await _get_driver_or_404(db, trip.driver_id)

    now = datetime.now(timezone.utc)
    trip.status = TripStatus.completed
    trip.completed_at = now
    trip.actual_distance_km = Decimal(str(data.actual_distance_km))
    vehicle.odometer_km = Decimal(str(data.final_odometer_km))
    vehicle.status = VehicleStatus.available
    driver.status = DriverStatus.available

    await _commit_or_rollback(db)
    await db.refresh(trip)
    return trip


async def cancel_trip(db: AsyncSession, trip_id: UUID, data: TripCancelRequest) -> Trip:
    trip = await _get_trip_or_404(db, trip_id)
    if trip.status != TripStatus.dispatched:
        raise HTTPException(
            status_code=400,
            detail=f"Trip must be dispatched to cancel (current status: {trip.status.value})",
        )

    vehicle = await _get_vehicle_or_404(db, trip.vehicle_id)
    driver = await _get_driver_or_404(db, trip.driver_id)

    now = datetime.now(timezone.utc)
    trip.status = TripStatus.cancelled
    trip.cancelled_at = now
    trip.notes = f"{trip.notes or ''}\n[Cancelled] {data.reason}".strip()
    vehicle.status = VehicleStatus.available
    driver.status = DriverStatus.available

    await _commit_or_rollback(db)
    await db.refresh(trip)
    return trip
