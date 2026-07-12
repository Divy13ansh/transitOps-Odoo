from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.vehicle import Vehicle, VehicleStatus


async def create_maintenance(
    vehicle_id: UUID,
    maintenance_type: str,
    description: str | None,
    cost: float,
    odometer_at_service: float | None,
    scheduled_date,
    created_by: UUID | None,
    db: AsyncSession,
) -> MaintenanceLog:
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    log = MaintenanceLog(
        vehicle_id=vehicle_id,
        type=maintenance_type,
        description=description,
        cost=cost,
        odometer_at_service=odometer_at_service,
        scheduled_date=scheduled_date,
        created_by=created_by,
    )
    db.add(log)

    # BR-09: Opening maintenance auto-sets vehicle to in_shop
    vehicle.status = VehicleStatus.in_shop

    await db.commit()
    await db.refresh(log)
    return log


async def close_maintenance(
    log_id: UUID,
    completed_date,
    final_cost: float | None,
    db: AsyncSession,
) -> MaintenanceLog:
    log = await db.get(MaintenanceLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    if log.status == MaintenanceStatus.closed:
        raise HTTPException(status_code=400, detail="Maintenance record is already closed")

    vehicle = await db.get(Vehicle, log.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Associated vehicle not found")

    log.status = MaintenanceStatus.closed
    log.completed_date = completed_date
    if final_cost is not None:
        log.cost = final_cost

    # BR-10 / BR-11: Restore vehicle status unless retired
    if vehicle.status != VehicleStatus.retired:
        vehicle.status = VehicleStatus.available

    await db.commit()
    await db.refresh(log)
    return log
