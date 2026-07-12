from uuid import UUID
from datetime import date
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver, DriverStatus
from app.models.trip import Trip, TripStatus


async def validate_trip_creation(
    vehicle_id: UUID,
    driver_id: UUID,
    cargo_weight_kg: float,
    db: AsyncSession,
) -> tuple[Vehicle, Driver]:
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    driver = await db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")

    # BR-02: Vehicle must be available
    if vehicle.status != VehicleStatus.available:
        raise HTTPException(
            status_code=400,
            detail=f"Vehicle {vehicle.registration_number} is not available for dispatch (current status: {vehicle.status.value})",
        )

    # BR-03: Driver must be available
    if driver.status != DriverStatus.available:
        raise HTTPException(
            status_code=400,
            detail=f"Driver {driver.full_name} cannot be assigned (current status: {driver.status.value})",
        )

    # BR-04: Driver license must not be expired
    if driver.license_expiry < date.today():
        raise HTTPException(
            status_code=400,
            detail=f"Driver {driver.full_name} license expired on {driver.license_expiry}",
        )

    # BR-05: Cargo weight <= vehicle max load
    if cargo_weight_kg > float(vehicle.max_load_kg):
        raise HTTPException(
            status_code=400,
            detail=f"Cargo {cargo_weight_kg} kg exceeds vehicle max capacity {vehicle.max_load_kg} kg",
        )

    return vehicle, driver


async def get_eligible_candidates(
    cargo_weight_kg: float,
    planned_distance_km: float,
    db: AsyncSession,
) -> dict:
    vehicles_result = await db.execute(
        select(Vehicle).where(Vehicle.status == VehicleStatus.available)
    )
    available_vehicles = vehicles_result.scalars().all()

    drivers_result = await db.execute(
        select(Driver).where(
            Driver.status == DriverStatus.available,
            Driver.license_expiry >= date.today(),
        )
    )
    eligible_drivers = drivers_result.scalars().all()

    eligible_vehicles = [
        v for v in available_vehicles
        if float(v.max_load_kg) >= cargo_weight_kg
    ]

    excluded_vehicles = [
        v for v in available_vehicles
        if float(v.max_load_kg) < cargo_weight_kg
    ]

    all_vehicles_result = await db.execute(select(Vehicle))
    all_vehicles = {v.id: v for v in all_vehicles_result.scalars().all()}

    all_drivers_result = await db.execute(select(Driver))
    all_drivers = {d.id: d for d in all_drivers_result.scalars().all()}

    excluded_parts = []
    for v in excluded_vehicles:
        excluded_parts.append(f"{v.name} excluded — max load {v.max_load_kg} kg < {cargo_weight_kg} kg required")
    busy_drivers = await db.execute(
        select(Driver).where(Driver.status == DriverStatus.on_trip)
    )
    for d in busy_drivers.scalars().all():
        excluded_parts.append(f"{d.full_name} excluded — currently on trip")

    candidates = []
    for v in eligible_vehicles:
        for d in eligible_drivers:
            candidates.append({
                "vehicle_id": str(v.id),
                "vehicle_name": v.name,
                "driver_id": str(d.id),
                "driver_name": d.full_name,
                "vehicle_max_load_kg": float(v.max_load_kg),
                "driver_safety_score": float(d.safety_score),
                "driver_license_expiry": str(d.license_expiry),
            })

    return {
        "candidates": candidates,
        "excluded": "; ".join(excluded_parts) if excluded_parts else None,
        "all_vehicles": {str(k): {"name": v.name, "status": v.status.value} for k, v in all_vehicles.items()},
        "all_drivers": {str(k): {"name": d.full_name, "status": d.status.value} for k, d in all_drivers.items()},
    }
