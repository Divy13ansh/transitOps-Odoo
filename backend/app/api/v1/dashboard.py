import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from dateutil import parser as dateparser

from app.core.deps import get_db
from app.models.briefing_cache import BriefingCache
from app.schemas.briefing import BriefingResponse

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
