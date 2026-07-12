from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user
from app.models.vehicle import Vehicle, VehicleStatus

router = APIRouter(prefix="/fleet", tags=["Fleet"])


class VehicleLocationResponse(BaseModel):
    vehicle_id: UUID
    registration_number: str
    name: str
    status: str
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


@router.get("/locations", response_model=list[VehicleLocationResponse])
async def get_fleet_locations(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Retrieve all non-retired vehicles
    result = await db.execute(
        select(Vehicle).where(Vehicle.status != VehicleStatus.retired)
    )
    vehicles = result.scalars().all()
    
    return [
        VehicleLocationResponse(
            vehicle_id=v.id,
            registration_number=v.registration_number,
            name=v.name,
            status=v.status.value,
            lat=float(v.lat) if v.lat is not None else None,
            lng=float(v.lng) if v.lng is not None else None,
        )
        for v in vehicles
    ]
