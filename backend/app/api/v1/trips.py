import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_roles
from app.schemas.trip import (
    TripCancelRequest,
    TripCompleteRequest,
    TripCreate,
    TripListResponse,
    TripResponse,
    TripUpdate,
    TripSuggestRequest,
    TripSuggestResponse,
    TripSuggestionItem,
)
from app.services import trip_service
from app.services.llm_service import call_llm
import json

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("", response_model=TripListResponse)
async def list_trips_endpoint(
    status: Optional[str] = Query(default=None),
    vehicle_id: Optional[UUID] = Query(default=None),
    driver_id: Optional[UUID] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trips, total = await trip_service.list_trips(
        db, status=status, vehicle_id=vehicle_id, driver_id=driver_id, page=page, page_size=page_size
    )
    pages = math.ceil(total / page_size) if page_size else 1
    return TripListResponse(
        items=[TripResponse.model_validate(t) for t in trips],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=TripResponse,
    status_code=201,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def create_trip_endpoint(
    trip_data: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.create_trip(db, trip_data, created_by=current_user.id)
    return TripResponse.model_validate(trip)


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip_endpoint(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.get_trip(db, trip_id)
    return TripResponse.model_validate(trip)


@router.patch(
    "/{trip_id}",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def update_trip_endpoint(
    trip_id: UUID,
    trip_data: TripUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.update_trip_draft(db, trip_id, trip_data)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/dispatch",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def dispatch_trip_endpoint(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.dispatch_trip(db, trip_id)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/complete",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def complete_trip_endpoint(
    trip_id: UUID,
    data: TripCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.complete_trip(db, trip_id, data)
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/cancel",
    response_model=TripResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def cancel_trip_endpoint(
    trip_id: UUID,
    data: TripCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trip = await trip_service.cancel_trip(db, trip_id, data)
    return TripResponse.model_validate(trip)


SUGGEST_SYSTEM_PROMPT = """You are TransitOps AI Dispatch Advisor. Rank the top 1-3 eligible vehicle+driver candidates for the trip.

Input received:
- Trip request details (source, destination, cargo_weight_kg, planned_distance_km)
- Pre-filtered eligible candidate pairs (each containing vehicle_id, vehicle_name, vehicle_max_load_kg, driver_id, driver_name, driver_safety_score)

Rules:
- Output only candidates from the eligible list.
- Prioritize higher driver safety score and closer vehicle capacity match (lower excess capacity margin, but must fit cargo weight).
- For each suggestion, provide a brief one-line reason (e.g. "Capacity fits with 50 kg margin, 96% safety score, no active trips").
- Output EXACTLY this JSON format (valid JSON only, no markdown wrapping, no trailing commas):
{
  "suggestions": [
    {
      "rank": 1,
      "vehicle_id": "uuid",
      "vehicle_name": "name",
      "driver_id": "uuid",
      "driver_name": "name",
      "reason": "reason string"
    }
  ]
}
"""

@router.post(
    "/suggest",
    response_model=TripSuggestResponse,
    dependencies=[require_roles("fleet_manager", "dispatcher")],
)
async def suggest_trip_dispatch(
    payload: TripSuggestRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    candidate_data = await trip_service.get_eligible_candidates(
        cargo_weight_kg=payload.cargo_weight_kg,
        planned_distance_km=payload.planned_distance_km,
        db=db,
    )
    candidates = candidate_data.get("candidates", [])
    excluded = candidate_data.get("excluded", "None.")

    if not candidates:
        return TripSuggestResponse(suggestions=[], excluded=excluded)

    # Prepare LLM context
    context = {
        "trip": payload.model_dump(),
        "candidates": candidates[:10],  # Limit to top 10 candidates to conserve token usage
    }

    llm_response = await call_llm(SUGGEST_SYSTEM_PROMPT, context)

    suggestions_list = []
    if llm_response:
        try:
            # Clean up potential markdown formatting block from LLM
            clean_res = llm_response.strip()
            if clean_res.startswith("```json"):
                clean_res = clean_res[7:]
            if clean_res.endswith("```"):
                clean_res = clean_res[:-3]
            clean_res = clean_res.strip()
            
            parsed = json.loads(clean_res)
            raw_suggs = parsed.get("suggestions", [])
            for item in raw_suggs:
                suggestions_list.append(
                    TripSuggestionItem(
                        rank=int(item["rank"]),
                        vehicle_id=UUID(item["vehicle_id"]),
                        vehicle_name=item["vehicle_name"],
                        driver_id=UUID(item["driver_id"]),
                        driver_name=item["driver_name"],
                        reason=item["reason"],
                    )
                )
        except Exception:
            # Clear list to use programmatic fallback
            suggestions_list = []

    # Programmatic fallback if LLM is unavailable or fails to parse
    if not suggestions_list:
        # Sort by safety score descending
        sorted_candidates = sorted(candidates, key=lambda x: x["driver_safety_score"], reverse=True)
        for i, c in enumerate(sorted_candidates[:3]):
            margin = c["vehicle_max_load_kg"] - payload.cargo_weight_kg
            reason = f"Capacity fits with {margin:.1f}kg margin. Driver safety score: {c['driver_safety_score']:.1f}"
            suggestions_list.append(
                TripSuggestionItem(
                    rank=i + 1,
                    vehicle_id=UUID(c["vehicle_id"]),
                    vehicle_name=c["vehicle_name"],
                    driver_id=UUID(c["driver_id"]),
                    driver_name=c["driver_name"],
                    reason=reason,
                )
            )

    return TripSuggestResponse(suggestions=suggestions_list, excluded=excluded)
