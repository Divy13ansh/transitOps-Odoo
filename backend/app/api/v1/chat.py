import json
from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver
from app.models.trip import Trip, TripStatus
from app.models.expense import Expense
from app.schemas.chat import ChatAskRequest, ChatAskResponse

router = APIRouter(prefix="/chat", tags=["Chat"])

CHAT_SYSTEM_PROMPT = """You are TransitOps AI assistant. Answer the user's question about the fleet using the provided context data.

Rules:
- Only answer based on the data provided in context. Do not fabricate information.
- If the data doesn't contain enough info to answer, say so.
- Be concise — 2-4 sentences max.
- Use INR (₹) for monetary values.
- Reference specific vehicle names, driver names, or IDs when relevant."""

CHAT_FALLBACK = "I'm unable to process your question right now. Please try again later or check the dashboard for current fleet information."

CHAT_NO_CONTEXT_FALLBACK = "I don't have enough fleet data to answer that question. Please check the dashboard or try rephrasing."


async def _gather_context(question: str, db: AsyncSession) -> dict:
    context = {}

    # Vehicles summary
    vehicles_result = await db.execute(select(Vehicle))
    vehicles = vehicles_result.scalars().all()
    context["vehicles"] = [
        {
            "id": str(v.id),
            "name": v.name,
            "registration_number": v.registration_number,
            "type": v.type,
            "status": v.status.value,
            "max_load_kg": float(v.max_load_kg),
            "region": v.region,
        }
        for v in vehicles
    ]

    # Drivers summary
    drivers_result = await db.execute(select(Driver))
    drivers = drivers_result.scalars().all()
    context["drivers"] = [
        {
            "id": str(d.id),
            "full_name": d.full_name,
            "license_number": d.license_number,
            "license_category": d.license_category,
            "license_expiry": str(d.license_expiry),
            "safety_score": float(d.safety_score),
            "status": d.status.value,
        }
        for d in drivers
    ]

    # Recent trips
    try:
        trips_result = await db.execute(
            select(Trip).order_by(Trip.created_at.desc()).limit(10)
        )
        trips = trips_result.scalars().all()
        context["recent_trips"] = [
            {
                "id": str(t.id),
                "source": t.source,
                "destination": t.destination,
                "status": t.status.value,
                "cargo_weight_kg": float(t.cargo_weight_kg),
                "revenue": float(t.revenue),
            }
            for t in trips
        ]
    except Exception:
        context["recent_trips"] = []

    # Expenses summary
    try:
        expenses_result = await db.execute(select(Expense).limit(10))
        expenses = expenses_result.scalars().all()
        context["expenses"] = [
            {
                "id": str(e.id),
                "vehicle_id": str(e.vehicle_id),
                "category": e.category.value,
                "amount": float(e.amount),
                "description": e.description,
            }
            for e in expenses
        ]
    except Exception:
        context["expenses"] = []

    # Fleet KPIs
    try:
        kpi_result = await db.execute(text("SELECT * FROM vw_fleet_kpis"))
        kpi_row = kpi_result.mappings().one_or_none()
        if kpi_row:
            context["fleet_kpis"] = dict(kpi_row)
    except Exception:
        context["fleet_kpis"] = {}

    return context


@router.post("/ask", response_model=ChatAskResponse)
async def ask_transitops(
    payload: ChatAskRequest,
    db: AsyncSession = Depends(get_db),
):
    from app.services.llm_service import call_llm

    # Context-stuffing: pull all relevant fleet data
    context = await _gather_context(payload.question, db)

    if not context.get("vehicles") and not context.get("drivers"):
        return ChatAskResponse(answer=CHAT_NO_CONTEXT_FALLBACK)

    # Add the question to context
    context["user_question"] = payload.question

    llm_response = await call_llm(CHAT_SYSTEM_PROMPT, context)

    if llm_response is None:
        return ChatAskResponse(answer=CHAT_FALLBACK)

    return ChatAskResponse(answer=llm_response)
