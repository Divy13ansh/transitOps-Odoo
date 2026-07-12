import math
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_roles, PaginationParams
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripResponse,
    TripListResponse,
    DispatchSuggestRequest,
    DispatchSuggestResponse,
    DispatchSuggestionItem,
)
from app.services.trip_service import validate_trip_creation, get_eligible_candidates

router = APIRouter(prefix="/trips", tags=["Trips"])

DISPATCH_ADVISOR_PROMPT = """You are TransitOps AI Dispatch Advisor. You rank and explain vehicle-driver pair suggestions for dispatch.

You will receive a list of pre-filtered eligible candidates (vehicle + driver pairs) that already satisfy all eligibility rules.
Your job is ONLY to rank these candidates and provide a brief reason for each ranking. Do NOT add, remove, or re-evaluate eligibility.

Rank based on:
1. Safety score (higher is better)
2. Vehicle capacity margin (more margin = safer)
3. License expiry (longer validity = better)

Output EXACTLY this JSON format:
{
  "suggestions": [
    {
      "rank": 1,
      "vehicle_id": "uuid",
      "vehicle_name": "name",
      "driver_id": "uuid",
      "driver_name": "name",
      "reason": "brief explanation"
    }
  ],
  "excluded": "summary of excluded candidates"
}

Do not include any text outside the JSON object."""

DISPATCH_ADVISOR_FALLBACK = {
    "suggestions": [
        {
            "rank": 1,
            "vehicle_id": "00000000-0000-0000-0000-000000000000",
            "vehicle_name": "Van-01",
            "driver_id": "00000000-0000-0000-0000-000000000000",
            "driver_name": "Default Driver",
            "reason": "Highest safety score and sufficient capacity margin.",
        }
    ],
    "excluded": "No additional candidates excluded.",
}


@router.post("/", response_model=TripResponse, status_code=201)
async def create_trip(
    payload: TripCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    # Validate all preconditions (BR-02 through BR-05)
    await validate_trip_creation(
        payload.vehicle_id,
        payload.driver_id,
        payload.cargo_weight_kg,
        db,
    )

    trip = Trip(
        **payload.model_dump(),
        status=TripStatus.draft,
        created_by=_user.id,
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return TripResponse.model_validate(trip)


@router.get("/", response_model=TripListResponse)
async def list_trips(
    status: TripStatus | None = None,
    vehicle_id: UUID | None = None,
    driver_id: UUID | None = None,
    sort_by: str = "created_at",
    sort_order: str = "asc",
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Trip)
    count_stmt = select(func.count()).select_from(Trip)

    if status:
        stmt = stmt.where(Trip.status == status)
        count_stmt = count_stmt.where(Trip.status == status)
    if vehicle_id:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)
        count_stmt = count_stmt.where(Trip.vehicle_id == vehicle_id)
    if driver_id:
        stmt = stmt.where(Trip.driver_id == driver_id)
        count_stmt = count_stmt.where(Trip.driver_id == driver_id)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0
    pages = max(1, math.ceil(total / pagination.page_size))

    sort_col = getattr(Trip, sort_by, Trip.created_at)
    if sort_order == "desc":
        stmt = stmt.order_by(sort_col.desc())
    else:
        stmt = stmt.order_by(sort_col.asc())

    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(stmt)
    trips = result.scalars().all()

    return TripListResponse(
        items=[TripResponse.model_validate(t) for t in trips],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        pages=pages,
    )


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    trip = await db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripResponse.model_validate(trip)


@router.patch("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: UUID,
    payload: TripUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    trip = await db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.status != TripStatus.draft:
        raise HTTPException(
            status_code=400,
            detail="Only draft trips can be updated",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # If vehicle_id, driver_id, or cargo_weight_kg changed, re-validate
    if "vehicle_id" in update_data or "driver_id" in update_data or "cargo_weight_kg" in update_data:
        vid = update_data.get("vehicle_id", trip.vehicle_id)
        did = update_data.get("driver_id", trip.driver_id)
        cw = update_data.get("cargo_weight_kg", trip.cargo_weight_kg)
        await validate_trip_creation(vid, did, cw, db)

    for field, value in update_data.items():
        setattr(trip, field, value)

    await db.commit()
    await db.refresh(trip)
    return TripResponse.model_validate(trip)


@router.post("/suggest", response_model=DispatchSuggestResponse)
async def suggest_dispatch(
    payload: DispatchSuggestRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = require_roles("fleet_manager", "dispatcher"),
):
    from app.services.llm_service import call_llm

    candidate_data = await get_eligible_candidates(
        payload.cargo_weight_kg,
        payload.planned_distance_km,
        db,
    )

    if not candidate_data["candidates"]:
        return DispatchSuggestResponse(
            suggestions=[],
            excluded=candidate_data.get("excluded", "No eligible candidates found."),
        )

    llm_context = {
        "candidates": candidate_data["candidates"],
        "source": payload.source,
        "destination": payload.destination,
        "cargo_weight_kg": payload.cargo_weight_kg,
        "planned_distance_km": payload.planned_distance_km,
    }

    llm_response = await call_llm(DISPATCH_ADVISOR_PROMPT, llm_context)

    if llm_response is None:
        # Use fallback built from first eligible candidate
        c = candidate_data["candidates"][0]
        fallback = {
            "suggestions": [
                {
                    "rank": 1,
                    "vehicle_id": c["vehicle_id"],
                    "vehicle_name": c["vehicle_name"],
                    "driver_id": c["driver_id"],
                    "driver_name": c["driver_name"],
                    "reason": f"Best match: capacity {c['vehicle_max_load_kg']} kg fits {payload.cargo_weight_kg} kg cargo, safety score {c['driver_safety_score']}.",
                }
            ],
            "excluded": candidate_data.get("excluded", "No additional candidates excluded."),
        }
        return DispatchSuggestResponse(**fallback)

    # Parse LLM JSON response
    try:
        parsed = json.loads(llm_response)
        return DispatchSuggestResponse(
            suggestions=[
                DispatchSuggestionItem(**s) for s in parsed["suggestions"]
            ],
            excluded=parsed.get("excluded"),
        )
    except (json.JSONDecodeError, KeyError, TypeError):
        # Fallback on parse failure
        c = candidate_data["candidates"][0]
        fallback = {
            "suggestions": [
                {
                    "rank": 1,
                    "vehicle_id": c["vehicle_id"],
                    "vehicle_name": c["vehicle_name"],
                    "driver_id": c["driver_id"],
                    "driver_name": c["driver_name"],
                    "reason": f"Best match: capacity {c['vehicle_max_load_kg']} kg fits {payload.cargo_weight_kg} kg cargo, safety score {c['driver_safety_score']}.",
                }
            ],
            "excluded": candidate_data.get("excluded", "No additional candidates excluded."),
        }
        return DispatchSuggestResponse(**fallback)


# Stubs owned by Backend Dev 1
@router.post("/{trip_id}/dispatch", status_code=501)
async def dispatch_trip_stub(trip_id: UUID):
    """Owned by Backend Dev 1."""
    raise HTTPException(status_code=501, detail="Not implemented — owned by Backend Dev 1")


@router.post("/{trip_id}/complete", status_code=501)
async def complete_trip_stub(trip_id: UUID):
    """Owned by Backend Dev 1."""
    raise HTTPException(status_code=501, detail="Not implemented — owned by Backend Dev 1")


@router.post("/{trip_id}/cancel", status_code=501)
async def cancel_trip_stub(trip_id: UUID):
    """Owned by Backend Dev 1."""
    raise HTTPException(status_code=501, detail="Not implemented — owned by Backend Dev 1")
