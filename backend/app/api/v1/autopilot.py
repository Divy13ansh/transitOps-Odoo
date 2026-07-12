import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles
from app.models.trip import Trip, TripStatus
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver, DriverStatus
from app.models.user import User
from app.schemas.autopilot import (
    AutopilotToggleRequest,
    AutopilotToggleResponse,
    AutopilotEvent,
    AutopilotFeedResponse,
)

router = APIRouter(prefix="/trips/autopilot", tags=["Control Tower"])

# In-memory state — single-org, single-deploy scope (hackathon demo only)
_autopilot_enabled = False
_autopilot_events: list[AutopilotEvent] = []

AUTOROUTE_SYSTEM_PROMPT = """You are TransitOps Control Tower. You evaluate whether a pending trip request can be auto-dispatched with high confidence.

You receive:
- A single pending trip request
- Pre-filtered eligible vehicle+driver candidates

Rules for auto-approval:
- Auto-dispatch ONLY if there is exactly ONE unambiguous best candidate
- If there are multiple candidates with similar suitability, escalate to pending
- If there are zero candidates, escalate with reason "no eligible candidates"
- If candidates have conflicting capacity (one barely fits, another has margin), escalate

Output EXACTLY this JSON:
{
  "action": "dispatch" | "escalate",
  "vehicle_id": "uuid or null",
  "driver_id": "uuid or null",
  "reason": "explanation"
}

Only output valid JSON, nothing else."""

AUTOROUTE_FALLBACK = {
    "action": "escalate",
    "vehicle_id": None,
    "driver_id": None,
    "reason": "Unable to evaluate — LLM service unavailable. Manual review required.",
}


def _get_pending_trip_requests() -> list[dict]:
    """Return synthetic pending trip requests for demo. In production this would
    come from a trip_requests table or message queue."""
    return []


async def _process_pending_requests(db: AsyncSession):
    """Evaluate pending trip requests for auto-dispatch."""
    from app.services.trip_service import get_eligible_candidates
    from app.services.llm_service import call_llm

    # Fetch draft trips that haven't been evaluated yet
    result = await db.execute(
        select(Trip).where(Trip.status == TripStatus.draft)
    )
    draft_trips = result.scalars().all()

    for trip in draft_trips:
        # Get eligible candidates for this trip
        candidate_data = await get_eligible_candidates(
            cargo_weight_kg=float(trip.cargo_weight_kg),
            planned_distance_km=float(trip.planned_distance_km),
            db=db,
        )

        candidates = candidate_data.get("candidates", [])

        if len(candidates) == 0:
            event = AutopilotEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc),
                event_type="no_candidates",
                trip_id=trip.id,
                reason="No eligible vehicles/drivers found for this trip.",
                status="rejected",
            )
            _autopilot_events.append(event)
            continue

        if len(candidates) == 1:
            # Unambiguous — auto-dispatch
            c = candidates[0]
            vehicle = await db.get(Vehicle, uuid.UUID(c["vehicle_id"]))
            driver = await db.get(Driver, uuid.UUID(c["driver_id"]))

            # Perform dispatch atomically (BR-02 through BR-06)
            trip.status = TripStatus.dispatched
            trip.dispatched_at = datetime.now(timezone.utc)
            if vehicle:
                vehicle.status = VehicleStatus.on_trip
            if driver:
                driver.status = DriverStatus.on_trip

            event = AutopilotEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc),
                event_type="auto_dispatched",
                trip_id=trip.id,
                vehicle_id=uuid.UUID(c["vehicle_id"]),
                vehicle_name=c["vehicle_name"],
                driver_id=uuid.UUID(c["driver_id"]),
                driver_name=c["driver_name"],
                reason=f"Single unambiguous candidate: {c['vehicle_name']} + {c['driver_name']}. Capacity {c['vehicle_max_load_kg']}kg fits {float(trip.cargo_weight_kg)}kg cargo.",
                status="dispatched",
            )
            _autopilot_events.append(event)
            continue

        # Multiple candidates — ask LLM to decide
        llm_context = {
            "trip": {
                "id": str(trip.id),
                "source": trip.source,
                "destination": trip.destination,
                "cargo_weight_kg": float(trip.cargo_weight_kg),
                "planned_distance_km": float(trip.planned_distance_km),
            },
            "candidates": candidates,
            "excluded": candidate_data.get("excluded"),
        }

        llm_response = await call_llm(AUTOROUTE_SYSTEM_PROMPT, llm_context)

        if llm_response is None:
            parsed = AUTOROUTE_FALLBACK.copy()
        else:
            try:
                parsed = json.loads(llm_response)
            except (json.JSONDecodeError, KeyError, TypeError):
                parsed = AUTOROUTE_FALLBACK.copy()

        if parsed.get("action") == "dispatch" and parsed.get("vehicle_id") and parsed.get("driver_id"):
            # Only auto-dispatch if LLM explicitly says dispatch
            vehicle = await db.get(Vehicle, uuid.UUID(parsed["vehicle_id"]))
            driver = await db.get(Driver, uuid.UUID(parsed["driver_id"]))

            if vehicle and driver and vehicle.status == VehicleStatus.available and driver.status == DriverStatus.available:
                trip.status = TripStatus.dispatched
                trip.dispatched_at = datetime.now(timezone.utc)
                vehicle.status = VehicleStatus.on_trip
                driver.status = DriverStatus.on_trip

                event = AutopilotEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.now(timezone.utc),
                    event_type="auto_dispatched",
                    trip_id=trip.id,
                    vehicle_id=uuid.UUID(parsed["vehicle_id"]),
                    vehicle_name=vehicle.name,
                    driver_id=uuid.UUID(parsed["driver_id"]),
                    driver_name=driver.full_name,
                    reason=parsed.get("reason", "LLM approved single candidate dispatch."),
                    status="dispatched",
                )
            else:
                # Re-check failed, escalate
                event = AutopilotEvent(
                    id=str(uuid.uuid4()),
                    timestamp=datetime.now(timezone.utc),
                    event_type="escalated",
                    trip_id=trip.id,
                    reason=f"LLM recommended dispatch but re-validation failed. {parsed.get('reason', 'Candidate no longer eligible.')}",
                    status="pending",
                )
        else:
            # LLM says escalate, or ambiguous
            vehicle_name = None
            driver_name = None
            if parsed.get("vehicle_id"):
                v = await db.get(Vehicle, uuid.UUID(parsed["vehicle_id"]))
                if v:
                    vehicle_name = v.name
            if parsed.get("driver_id"):
                d = await db.get(Driver, uuid.UUID(parsed["driver_id"]))
                if d:
                    driver_name = d.full_name

            event = AutopilotEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc),
                event_type="escalated",
                trip_id=trip.id,
                vehicle_id=uuid.UUID(parsed["vehicle_id"]) if parsed.get("vehicle_id") else None,
                vehicle_name=vehicle_name,
                driver_id=uuid.UUID(parsed["driver_id"]) if parsed.get("driver_id") else None,
                driver_name=driver_name,
                reason=parsed.get("reason", "Ambiguous candidate set — manual review required."),
                status="pending",
            )

        _autopilot_events.append(event)

    # Commit all state changes atomically
    await db.commit()


@router.post("/toggle", response_model=AutopilotToggleResponse)
async def toggle_autopilot(
    payload: AutopilotToggleRequest,
    _user: User = require_roles("fleet_manager"),
):
    global _autopilot_enabled
    _autopilot_enabled = payload.enabled
    return AutopilotToggleResponse(
        enabled=_autopilot_enabled,
        message=f"Autopilot {'enabled' if _autopilot_enabled else 'disabled'}",
    )


@router.get("/feed", response_model=AutopilotFeedResponse)
async def get_autopilot_feed(
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    global _autopilot_enabled

    # If autopilot is enabled, process any pending draft trips
    if _autopilot_enabled:
        await _process_pending_requests(db)

    total_dispatched = sum(1 for e in _autopilot_events if e.status == "dispatched")
    total_escalated = sum(1 for e in _autopilot_events if e.status == "pending")

    return AutopilotFeedResponse(
        events=list(reversed(_autopilot_events)),
        autopilot_enabled=_autopilot_enabled,
        total_dispatched=total_dispatched,
        total_escalated=total_escalated,
    )
