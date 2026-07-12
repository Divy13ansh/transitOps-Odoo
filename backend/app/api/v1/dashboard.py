import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.briefing_cache import BriefingCache
from app.models.trip import Trip
from app.models.enums import TripStatus
from app.schemas.briefing import BriefingResponse
from app.schemas.dashboard import DashboardResponse
from app.schemas.trip import TripResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

BRIEFING_SYSTEM_PROMPT = """You are TransitOps AI Daily Ops Briefing assistant. Generate a concise 3-4 sentence operational briefing for fleet managers.

Based on the fleet data provided, highlight:
1. Current fleet utilization percentage
2. Any vehicles with high maintenance/fuel costs this month
3. Drivers with licenses expiring soon
4. Any notable operational concerns

Keep the tone professional and actionable. Use INR (₹) for monetary values. Be specific with numbers."""

BRIEFING_FALLBACK = (
    "Fleet operations are running normally. "
    "Utilization is within expected range. "
    "No critical alerts at this time. "
    "Please check the dashboard for detailed metrics."
)


@router.get("", response_model=DashboardResponse)
async def get_dashboard_metrics(
    vehicle_type: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    region_pattern = f"%{region}%" if region is not None else None
    
    # Query vehicle counts
    veh_query = text(
        """
        SELECT
            COUNT(*) AS total_vehicles,
            COUNT(*) FILTER (WHERE status = 'available') AS available_vehicles,
            COUNT(*) FILTER (WHERE status = 'on_trip') AS vehicles_on_trip,
            COUNT(*) FILTER (WHERE status = 'in_shop') AS vehicles_in_shop,
            COUNT(*) FILTER (WHERE status = 'retired') AS vehicles_retired
        FROM vehicles
        WHERE (CAST(:vehicle_type AS VARCHAR) IS NULL OR type = :vehicle_type)
          AND (CAST(:region AS VARCHAR) IS NULL OR region ILIKE :region_pattern)
        """
    )
    veh_result = await db.execute(
        veh_query,
        {"vehicle_type": vehicle_type, "region": region, "region_pattern": region_pattern}
    )
    v_row = veh_result.mappings().one()
    
    total = v_row["total_vehicles"] or 0
    available = v_row["available_vehicles"] or 0
    on_trip = v_row["vehicles_on_trip"] or 0
    in_shop = v_row["vehicles_in_shop"] or 0
    retired = v_row["vehicles_retired"] or 0
    
    active_denom = total - retired
    util_pct = round((on_trip / active_denom) * 100, 1) if active_denom > 0 else 0.0

    # Query trip counts
    trip_query = text(
        """
        SELECT
            COUNT(*) FILTER (WHERE t.status = 'dispatched') AS active_trips,
            COUNT(*) FILTER (WHERE t.status = 'draft') AS pending_trips
        FROM trips t
        JOIN vehicles v ON v.id = t.vehicle_id
        WHERE (CAST(:vehicle_type AS VARCHAR) IS NULL OR v.type = :vehicle_type)
          AND (CAST(:region AS VARCHAR) IS NULL OR v.region ILIKE :region_pattern)
        """
    )
    trip_result = await db.execute(
        trip_query,
        {"vehicle_type": vehicle_type, "region": region, "region_pattern": region_pattern}
    )
    t_row = trip_result.mappings().one()
    active_trips = t_row["active_trips"] or 0
    pending_trips = t_row["pending_trips"] or 0

    # Query driver counts
    drv_query = text(
        """
        SELECT
            COUNT(*) FILTER (WHERE status = 'on_trip') AS drivers_on_duty,
            COUNT(*) FILTER (WHERE status = 'available') AS drivers_available
        FROM drivers
        """
    )
    drv_result = await db.execute(drv_query)
    d_row = drv_result.mappings().one()
    drivers_on_duty = d_row["drivers_on_duty"] or 0
    drivers_available = d_row["drivers_available"] or 0

    return DashboardResponse(
        total_vehicles=total,
        available_vehicles=available,
        vehicles_on_trip=on_trip,
        vehicles_in_shop=in_shop,
        vehicles_retired=retired,
        fleet_utilization_pct=util_pct,
        active_trips=active_trips,
        pending_trips=pending_trips,
        drivers_on_duty=drivers_on_duty,
        drivers_available=drivers_available,
    )


@router.get("/active-trips", response_model=list[TripResponse])
async def get_active_trips(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Trip).where(Trip.status == TripStatus.dispatched).order_by(Trip.created_at.desc())
    )
    trips = result.scalars().all()
    return [TripResponse.model_validate(t) for t in trips]


@router.post("/briefing", response_model=BriefingResponse)
async def get_briefing(
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # Check cache first
    cache_result = await db.execute(
        select(BriefingCache).where(BriefingCache.expires_at > now).limit(1)
    )
    cached = cache_result.scalar_one_or_none()
    if cached is not None:
        return BriefingResponse(
            content=cached.content,
            generated_at=cached.generated_at,
            cached=True,
        )

    # Gather fleet context
    context_parts = {}

    try:
        kpi_result = await db.execute(text("SELECT * FROM vw_fleet_kpis"))
        kpi_row = kpi_result.mappings().one_or_none()
        if kpi_row:
            context_parts["fleet_kpis"] = dict(kpi_row)
    except Exception:
        context_parts["fleet_kpis"] = {}

    try:
        recent_trips = await db.execute(
            text("SELECT id, source, destination, status, revenue FROM trips ORDER BY created_at DESC LIMIT 5")
        )
        context_parts["recent_trips"] = [dict(r) for r in recent_trips.mappings().all()]
    except Exception:
        context_parts["recent_trips"] = []

    try:
        expiring = await db.execute(
            text("SELECT full_name, license_expiry FROM drivers WHERE license_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'")
        )
        context_parts["expiring_licenses"] = [dict(r) for r in expiring.mappings().all()]
    except Exception:
        context_parts["expiring_licenses"] = []

    # Call LLM
    from app.services.llm_service import call_llm

    llm_response = await call_llm(BRIEFING_SYSTEM_PROMPT, context_parts)

    if llm_response is None:
        # Try to retrieve the most recent cached entry, even if expired
        stale_result = await db.execute(
            select(BriefingCache).order_by(BriefingCache.generated_at.desc()).limit(1)
        )
        stale = stale_result.scalar_one_or_none()
        if stale:
            content = stale.content
        else:
            content = BRIEFING_FALLBACK
    else:
        content = llm_response

    # Cache the result
    new_cache = BriefingCache(
        content=content,
        generated_at=now,
        expires_at=now + timedelta(minutes=5),
    )
    db.add(new_cache)
    await db.commit()

    return BriefingResponse(
        content=content,
        generated_at=now,
        cached=False,
    )
