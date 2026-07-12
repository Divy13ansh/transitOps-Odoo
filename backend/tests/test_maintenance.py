import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import Vehicle, Role, User
from app.models.enums import VehicleStatus
from app.models.maintenance_log import MaintenanceStatus
from app.core.security import hash_password

@pytest.fixture
def anyio_backend():
    return "asyncio"

async def create_user_with_role(db: AsyncSession, client: AsyncClient, role_name: str) -> dict:
    role_stmt = select(Role).where(Role.name == role_name)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one()

    email = f"{role_name}-{uuid.uuid4().hex[:6]}@test.com"
    password = "TestPassword123!"
    user = User(
        full_name=f"Test {role_name}",
        email=email,
        hashed_password=hash_password(password),
        role_id=role.id,
        is_active=True
    )
    db.add(user)
    await db.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def fleet_manager_headers(client: AsyncClient, db: AsyncSession) -> dict:
    return await create_user_with_role(db, client, "fleet_manager")

@pytest.fixture
async def safety_officer_headers(client: AsyncClient, db: AsyncSession) -> dict:
    return await create_user_with_role(db, client, "safety_officer")

@pytest.fixture
async def dispatcher_headers(client: AsyncClient, db: AsyncSession) -> dict:
    return await create_user_with_role(db, client, "dispatcher")

@pytest.fixture
async def financial_analyst_headers(client: AsyncClient, db: AsyncSession) -> dict:
    return await create_user_with_role(db, client, "financial_analyst")

@pytest.fixture
async def vehicle(db: AsyncSession) -> Vehicle:
    veh = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Maintenance Test Vehicle",
        type="Van",
        max_load_kg=Decimal("800.00"),
        odometer_km=Decimal("12000.00"),
        acquisition_cost=Decimal("25000.00"),
        status=VehicleStatus.available,
        lat=Decimal("23.2156"),
        lng=Decimal("72.6369")
    )
    db.add(veh)
    await db.commit()
    await db.refresh(veh)
    return veh

@pytest.mark.anyio
async def test_maintenance_flow_success(
    client: AsyncClient,
    db: AsyncSession,
    fleet_manager_headers: dict,
    dispatcher_headers: dict,
    vehicle: Vehicle
):
    # 1. Verify vehicle is available
    res = await client.get("/api/v1/vehicles/available", headers=dispatcher_headers)
    assert res.status_code == 200
    available_ids = [v["id"] for v in res.json()]
    assert str(vehicle.id) in available_ids

    # 2. Create maintenance record
    payload = {
        "vehicle_id": str(vehicle.id),
        "type": "Oil Change",
        "description": "Scheduled maintenance",
        "cost": 150.0,
        "odometer_at_service": 12500.0,
        "scheduled_date": "2026-07-12"
    }
    res = await client.post("/api/v1/maintenance/", json=payload, headers=fleet_manager_headers)
    assert res.status_code == 201
    log_data = res.json()
    log_id = log_data["id"]
    assert log_data["status"] == "open"

    # Refresh vehicle from DB to check status
    await db.refresh(vehicle)
    assert vehicle.status == VehicleStatus.in_shop

    # Verify vehicle disappears from available list
    res = await client.get("/api/v1/vehicles/available", headers=dispatcher_headers)
    assert res.status_code == 200
    available_ids = [v["id"] for v in res.json()]
    assert str(vehicle.id) not in available_ids

    # 3. Close maintenance record
    close_payload = {
        "completed_date": "2026-07-13",
        "final_cost": 175.0
    }
    res = await client.post(f"/api/v1/maintenance/{log_id}/close", json=close_payload, headers=fleet_manager_headers)
    assert res.status_code == 200
    closed_log = res.json()
    assert closed_log["status"] == "closed"
    assert closed_log["cost"] == 175.0

    # Refresh vehicle to confirm it is available again
    await db.refresh(vehicle)
    assert vehicle.status == VehicleStatus.available

@pytest.mark.anyio
async def test_maintenance_close_does_not_restore_retired(
    client: AsyncClient,
    db: AsyncSession,
    fleet_manager_headers: dict,
    vehicle: Vehicle
):
    # 1. Create maintenance record
    payload = {
        "vehicle_id": str(vehicle.id),
        "type": "Engine Repair",
        "description": "Major breakdown",
        "cost": 1500.0,
        "odometer_at_service": 12500.0,
        "scheduled_date": "2026-07-12"
    }
    res = await client.post("/api/v1/maintenance/", json=payload, headers=fleet_manager_headers)
    assert res.status_code == 201
    log_id = res.json()["id"]

    # 2. Retire vehicle while in maintenance
    vehicle.status = VehicleStatus.retired
    await db.commit()

    # 3. Close maintenance
    close_payload = {
        "completed_date": "2026-07-13",
        "final_cost": 1500.0
    }
    res = await client.post(f"/api/v1/maintenance/{log_id}/close", json=close_payload, headers=fleet_manager_headers)
    assert res.status_code == 200

    # 4. Verify vehicle status remains retired
    await db.refresh(vehicle)
    assert vehicle.status == VehicleStatus.retired

@pytest.mark.anyio
async def test_maintenance_rbac(
    client: AsyncClient,
    dispatcher_headers: dict,
    financial_analyst_headers: dict,
    safety_officer_headers: dict,
    vehicle: Vehicle
):
    # 1. Dispatcher and Financial Analyst should get 403 on create
    payload = {
        "vehicle_id": str(vehicle.id),
        "type": "Tire Rotation",
        "description": "Routine check",
        "cost": 50.0,
        "odometer_at_service": 12500.0,
        "scheduled_date": "2026-07-12"
    }
    res = await client.post("/api/v1/maintenance/", json=payload, headers=dispatcher_headers)
    assert res.status_code == 403

    res = await client.post("/api/v1/maintenance/", json=payload, headers=financial_analyst_headers)
    assert res.status_code == 403

    # 2. Safety Officer should be able to create maintenance
    res = await client.post("/api/v1/maintenance/", json=payload, headers=safety_officer_headers)
    assert res.status_code == 201
    log_id = res.json()["id"]

    # 3. Dispatcher and Financial Analyst should get 403 on close
    close_payload = {
        "completed_date": "2026-07-13",
        "final_cost": 50.0
    }
    res = await client.post(f"/api/v1/maintenance/{log_id}/close", json=close_payload, headers=dispatcher_headers)
    assert res.status_code == 403

    res = await client.post(f"/api/v1/maintenance/{log_id}/close", json=close_payload, headers=financial_analyst_headers)
    assert res.status_code == 403

    # 4. Safety Officer should be able to close maintenance
    res = await client.post(f"/api/v1/maintenance/{log_id}/close", json=close_payload, headers=safety_officer_headers)
    assert res.status_code == 200
