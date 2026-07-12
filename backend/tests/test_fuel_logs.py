import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models import Vehicle
from app.models.enums import VehicleStatus

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def admin_headers(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": settings.default_admin_email, "password": settings.default_admin_password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def vehicle(db: AsyncSession) -> Vehicle:
    veh = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Test Fuel Truck",
        type="Heavy Truck",
        max_load_kg=Decimal("1500.00"),
        odometer_km=Decimal("100.00"),
        acquisition_cost=Decimal("50000.00"),
        status=VehicleStatus.available
    )
    db.add(veh)
    await db.commit()
    await db.refresh(veh)
    return veh

@pytest.mark.anyio
async def test_create_fuel_log_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle):
    payload = {
        "vehicle_id": str(vehicle.id),
        "liters": 50.0,
        "cost_per_liter": 2.50,
        "odometer_at_fill": 150.0,
        "filled_at": "2026-07-12"
    }
    response = await client.post(
        "/api/v1/fuel-logs/",
        json=payload,
        headers=admin_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["liters"] == 50.0
    assert data["cost_per_liter"] == 2.50
    assert data["total_cost"] == 125.0
