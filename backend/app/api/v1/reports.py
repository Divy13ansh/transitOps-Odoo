import csv
import io
from datetime import date, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.schemas.report import (
    FleetUtilizationPoint,
    FuelEfficiencyItem,
    OperationalCostItem,
    VehicleRoiItem,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_CSV_REPORTS = {"vehicle-roi", "fuel-efficiency", "operational-cost", "fleet-utilization"}


@router.get("/fuel-efficiency", response_model=list[FuelEfficiencyItem])
async def fuel_efficiency_endpoint(
    vehicle_id: Optional[UUID] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = await report_service.get_fuel_efficiency(db, vehicle_id=vehicle_id)
    return [FuelEfficiencyItem(**row) for row in rows]


@router.get(
    "/fleet-utilization",
    response_model=list[FleetUtilizationPoint],
    dependencies=[require_roles("fleet_manager", "financial_analyst")],
)
async def fleet_utilization_endpoint(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if end_date is None:
        end_date = date.today()
    if start_date is None:
        start_date = end_date - timedelta(days=29)
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")

    points = await report_service.get_fleet_utilization(db, start_date, end_date)
    return [FleetUtilizationPoint(**p) for p in points]


@router.get(
    "/operational-cost",
    response_model=list[OperationalCostItem],
    dependencies=[require_roles("fleet_manager", "financial_analyst")],
)
async def operational_cost_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = await report_service.get_operational_cost(db)
    return [OperationalCostItem(**row) for row in rows]


@router.get(
    "/vehicle-roi",
    response_model=list[VehicleRoiItem],
    dependencies=[require_roles("fleet_manager", "financial_analyst")],
)
async def vehicle_roi_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = await report_service.get_vehicle_roi(db)
    return [VehicleRoiItem(**row) for row in rows]


@router.get(
    "/export/csv",
    dependencies=[require_roles("fleet_manager", "financial_analyst")],
)
async def export_csv_endpoint(
    report: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if report not in VALID_CSV_REPORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report '{report}'. Must be one of: {', '.join(sorted(VALID_CSV_REPORTS))}",
        )

    if report == "vehicle-roi":
        rows = await report_service.get_vehicle_roi(db)
    elif report == "fuel-efficiency":
        rows = await report_service.get_fuel_efficiency(db)
    elif report == "operational-cost":
        rows = await report_service.get_operational_cost(db)
    else:  # fleet-utilization
        end_date = date.today()
        start_date = end_date - timedelta(days=29)
        rows = await report_service.get_fleet_utilization(db, start_date, end_date)

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        output.write("")

    output.seek(0)
    filename = f"{report.replace('-', '_')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
