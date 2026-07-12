from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.vehicle import Vehicle, VehicleStatus


async def get_fuel_efficiency(
    db: AsyncSession,
    vehicle_id: Optional[UUID] = None,
) -> list[dict]:
    """
    Reads from the existing vw_trip_fuel_efficiency view, joined to vehicles
    for the registration_number. Returns [] if no completed trips with fuel
    logs exist yet — do not raise an error on empty results.
    """
    query = text(
        """
        SELECT
            vfe.trip_id,
            vfe.vehicle_id,
            v.registration_number,
            vfe.actual_distance_km,
            COALESCE(vfe.total_liters, 0) AS total_liters,
            vfe.km_per_liter
        FROM vw_trip_fuel_efficiency vfe
        JOIN vehicles v ON v.id = vfe.vehicle_id
        WHERE (CAST(:vehicle_id AS UUID) IS NULL OR vfe.vehicle_id = :vehicle_id)
        ORDER BY vfe.trip_id
        """
    )
    result = await db.execute(query, {"vehicle_id": vehicle_id})
    rows = result.mappings().all()
    
    return [
        {
            "trip_id": row["trip_id"],
            "vehicle_id": row["vehicle_id"],
            "registration_number": row["registration_number"],
            "actual_distance_km": float(row["actual_distance_km"]) if row["actual_distance_km"] is not None else 0.0,
            "total_liters": float(row["total_liters"]),
            "km_per_liter": float(row["km_per_liter"]) if row["km_per_liter"] is not None else None,
        }
        for row in rows
    ]


async def get_fleet_utilization(
    db: AsyncSession,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Derived daily time series — NOT backed by a snapshot table (none exists).
    For each day in [start_date, end_date], counts vehicles that were on_trip
    that day based on trips.dispatched_at / completed_at / cancelled_at,
    divided by the count of non-retired vehicles.
    """
    total_active_result = await db.execute(
        select(func.count()).select_from(Vehicle).where(Vehicle.status != VehicleStatus.retired)
    )
    total_active = total_active_result.scalar_one() or 0

    points: list[dict] = []
    current = start_date
    while current <= end_date:
        query = text(
            """
            SELECT COUNT(DISTINCT vehicle_id) AS vehicles_on_trip
            FROM trips
            WHERE dispatched_at IS NOT NULL
              AND dispatched_at::date <= :day
              AND (completed_at IS NULL OR completed_at::date > :day)
              AND (cancelled_at IS NULL OR cancelled_at::date > :day)
            """
        )
        result = await db.execute(query, {"day": current})
        vehicles_on_trip = result.scalar_one() or 0

        utilization_pct = round((vehicles_on_trip / total_active) * 100, 1) if total_active else 0.0

        points.append(
            {
                "date": current,
                "vehicles_on_trip": int(vehicles_on_trip),
                "total_active_vehicles": int(total_active),
                "utilization_pct": float(utilization_pct),
            }
        )
        current += timedelta(days=1)

    return points


async def get_operational_cost(db: AsyncSession) -> list[dict]:
    """
    Reads from vw_vehicle_cost_summary. Returns one row per vehicle, with
    zero costs (not NULL) for vehicles with no fuel/maintenance records yet.
    """
    query = text(
        """
        SELECT
            vehicle_id,
            registration_number,
            name,
            COALESCE(total_fuel_cost, 0) AS total_fuel_cost,
            COALESCE(total_maintenance_cost, 0) AS total_maintenance_cost,
            COALESCE(total_operational_cost, 0) AS total_operational_cost
        FROM vw_vehicle_cost_summary
        ORDER BY registration_number
        """
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    
    return [
        {
            "vehicle_id": row["vehicle_id"],
            "registration_number": row["registration_number"],
            "name": row["name"],
            "total_fuel_cost": float(row["total_fuel_cost"]),
            "total_maintenance_cost": float(row["total_maintenance_cost"]),
            "total_operational_cost": float(row["total_operational_cost"]),
        }
        for row in rows
    ]


async def get_vehicle_roi(db: AsyncSession) -> list[dict]:
    """
    Reads from vw_vehicle_cost_summary. `roi` is NULL in the view when
    acquisition_cost is 0.
    """
    query = text(
        """
        SELECT
            vehicle_id,
            registration_number,
            name,
            acquisition_cost,
            COALESCE(total_fuel_cost, 0) AS total_fuel_cost,
            COALESCE(total_maintenance_cost, 0) AS total_maintenance_cost,
            COALESCE(total_operational_cost, 0) AS total_operational_cost,
            COALESCE(total_revenue, 0) AS total_revenue,
            roi
        FROM vw_vehicle_cost_summary
        ORDER BY registration_number
        """
    )
    result = await db.execute(query)
    rows = result.mappings().all()
    
    return [
        {
            "vehicle_id": row["vehicle_id"],
            "registration_number": row["registration_number"],
            "name": row["name"],
            "acquisition_cost": float(row["acquisition_cost"]) if row["acquisition_cost"] is not None else 0.0,
            "total_fuel_cost": float(row["total_fuel_cost"]),
            "total_maintenance_cost": float(row["total_maintenance_cost"]),
            "total_operational_cost": float(row["total_operational_cost"]),
            "total_revenue": float(row["total_revenue"]),
            "roi": float(row["roi"]) if row["roi"] is not None else None,
        }
        for row in rows
    ]
