import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import hash_password
from app.models import User, Role, Vehicle, Driver, Trip
from app.models.enums import VehicleStatus, DriverStatus, TripStatus


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
async def dispatcher_headers(client: AsyncClient, db: AsyncSession) -> dict:
    role_stmt = select(Role).where(Role.name == "dispatcher")
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one()

    email = f"dispatcher-{uuid.uuid4().hex[:6]}@test.com"
    password = "DispatcherPassword123!"
    dispatcher = User(
        full_name="Dispatcher User",
        email=email,
        hashed_password=hash_password(password),
        role_id=role.id,
        is_active=True
    )
    db.add(dispatcher)
    await db.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def vehicle(db: AsyncSession) -> Vehicle:
    veh = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Test Cargo Van",
        type="Van",
        max_load_kg=Decimal("1000.00"),
        odometer_km=Decimal("50.00"),
        acquisition_cost=Decimal("30000.00"),
        status=VehicleStatus.available
    )
    db.add(veh)
    await db.commit()
    await db.refresh(veh)
    return veh


@pytest.fixture
async def driver(db: AsyncSession) -> Driver:
    drv = Driver(
        full_name="John Doe Test",
        license_number=f"DL-{uuid.uuid4().hex[:10].upper()}",
        license_category="Class B",
        license_expiry=date.today() + timedelta(days=365),
        contact_number="+15550199",
        safety_score=Decimal("9.5"),
        status=DriverStatus.available
    )
    db.add(drv)
    await db.commit()
    await db.refresh(drv)
    return drv


@pytest.mark.anyio
async def test_create_trip_draft_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0,
        "notes": "Urgent delivery"
    }
    response = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["source"] == "Warehouse A"


@pytest.mark.anyio
async def test_create_trip_cargo_exceeds_capacity(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 1500.0,  # Exceeds max_load_kg of 1000
        "revenue": 1000.0
    }
    response = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == f"Cargo 1500.0 kg exceeds vehicle max capacity 1000.0 kg"


@pytest.mark.anyio
async def test_create_trip_allows_on_trip_vehicle(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Set vehicle and driver status to on_trip
    vehicle.status = VehicleStatus.on_trip
    driver.status = DriverStatus.on_trip
    await db.commit()

    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    response = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    assert response.status_code == 201
    assert response.json()["status"] == "draft"


@pytest.mark.anyio
async def test_dispatch_trip_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_response = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_response.json()["id"]

    dispatch_response = await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    assert dispatch_response.status_code == 200
    assert dispatch_response.json()["status"] == "dispatched"
    assert dispatch_response.json()["dispatched_at"] is not None

    # Verify vehicle and driver status are updated to on_trip in the DB
    await db.refresh(vehicle)
    await db.refresh(driver)
    assert vehicle.status == VehicleStatus.on_trip
    assert driver.status == DriverStatus.on_trip


@pytest.mark.anyio
async def test_dispatch_trip_not_draft(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    # Create and dispatch trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    
    # Try dispatching again
    second_dispatch = await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    assert second_dispatch.status_code == 400
    assert second_dispatch.json()["detail"] == "Trip must be in draft status to dispatch (current status: dispatched)"


@pytest.mark.anyio
async def test_dispatch_trip_vehicle_unavailable(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Make vehicle unavailable
    vehicle.status = VehicleStatus.in_shop
    await db.commit()

    dispatch_res = await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    assert dispatch_res.status_code == 400
    assert dispatch_res.json()["detail"] == f"Vehicle {vehicle.registration_number} is not available for dispatch (current status: in_shop)"


@pytest.mark.anyio
async def test_dispatch_trip_driver_unavailable(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Make driver suspended
    driver.status = DriverStatus.suspended
    await db.commit()

    dispatch_res = await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    assert dispatch_res.status_code == 400
    assert dispatch_res.json()["detail"] == f"Driver {driver.full_name} cannot be assigned (current status: suspended)"


@pytest.mark.anyio
async def test_dispatch_trip_driver_license_expired(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Make license expired
    driver.license_expiry = date.today() - timedelta(days=1)
    await db.commit()

    dispatch_res = await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)
    assert dispatch_res.status_code == 400
    assert dispatch_res.json()["detail"] == f"Driver {driver.full_name} license expired on {driver.license_expiry}"


@pytest.mark.anyio
async def test_complete_trip_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Dispatch trip
    await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)

    # Complete trip
    complete_payload = {
        "actual_distance_km": 145.5,
        "final_odometer_km": 195.5
    }
    complete_res = await client.post(f"/api/v1/trips/{trip_id}/complete", json=complete_payload, headers=admin_headers)
    assert complete_res.status_code == 200
    data = complete_res.json()
    assert data["status"] == "completed"
    assert data["completed_at"] is not None
    assert data["actual_distance_km"] == 145.5

    # Verify vehicle and driver status reverted, vehicle odometer updated
    await db.refresh(vehicle)
    await db.refresh(driver)
    assert vehicle.status == VehicleStatus.available
    assert float(vehicle.odometer_km) == 195.5
    assert driver.status == DriverStatus.available


@pytest.mark.anyio
async def test_complete_trip_not_dispatched(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Try completing draft trip
    complete_payload = {
        "actual_distance_km": 145.5,
        "final_odometer_km": 195.5
    }
    complete_res = await client.post(f"/api/v1/trips/{trip_id}/complete", json=complete_payload, headers=admin_headers)
    assert complete_res.status_code == 400
    assert complete_res.json()["detail"] == "Trip must be dispatched to complete (current status: draft)"


@pytest.mark.anyio
async def test_cancel_trip_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Dispatch trip
    await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)

    # Cancel trip
    cancel_payload = {
        "reason": "Cancelled by user"
    }
    cancel_res = await client.post(f"/api/v1/trips/{trip_id}/cancel", json=cancel_payload, headers=admin_headers)
    assert cancel_res.status_code == 200
    data = cancel_res.json()
    assert data["status"] == "cancelled"
    assert data["cancelled_at"] is not None

    # Verify vehicle and driver status reverted to available
    await db.refresh(vehicle)
    await db.refresh(driver)
    assert vehicle.status == VehicleStatus.available
    assert driver.status == DriverStatus.available


@pytest.mark.anyio
async def test_cancel_trip_not_dispatched(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Try cancelling draft trip
    cancel_payload = {
        "reason": "Cancelled by user"
    }
    cancel_res = await client.post(f"/api/v1/trips/{trip_id}/cancel", json=cancel_payload, headers=admin_headers)
    assert cancel_res.status_code == 400
    assert cancel_res.json()["detail"] == "Trip must be dispatched to cancel (current status: draft)"


@pytest.mark.anyio
async def test_update_trip_draft_success(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # PATCH draft trip
    update_payload = {
        "destination": "New Location C",
        "cargo_weight_kg": 750.0
    }
    update_res = await client.patch(f"/api/v1/trips/{trip_id}", json=update_payload, headers=admin_headers)
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["destination"] == "New Location C"
    assert data["cargo_weight_kg"] == 750.0


@pytest.mark.anyio
async def test_update_trip_not_draft(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver):
    # Create draft trip
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    create_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    trip_id = create_res.json()["id"]

    # Dispatch trip
    await client.post(f"/api/v1/trips/{trip_id}/dispatch", headers=admin_headers)

    # Try patching dispatched trip
    update_payload = {
        "destination": "New Location C"
    }
    update_res = await client.patch(f"/api/v1/trips/{trip_id}", json=update_payload, headers=admin_headers)
    assert update_res.status_code == 400
    assert update_res.json()["detail"] == "Trip can only be updated while in draft status (current status: dispatched)"


@pytest.mark.anyio
async def test_list_trips_filters_by_status(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Create 3 draft trips
    payload = {
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "source": "Warehouse A",
        "destination": "Depot B",
        "planned_distance_km": 150.0,
        "cargo_weight_kg": 500.0,
        "revenue": 1000.0
    }
    t1_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    t2_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)
    t3_res = await client.post("/api/v1/trips", json=payload, headers=admin_headers)

    t1_id = t1_res.json()["id"]
    t2_id = t2_res.json()["id"]

    # Dispatch t1 and t2 (using different vehicles/drivers for simplicity, or we can just update status directly in DB)
    # Let's bypass checks by directly updating Trip status in DB for t1 and t2 to dispatched
    trip1 = await db.get(Trip, uuid.UUID(t1_id))
    trip2 = await db.get(Trip, uuid.UUID(t2_id))
    trip1.status = TripStatus.dispatched
    trip2.status = TripStatus.dispatched
    await db.commit()

    # Call GET /trips?status=draft
    res = await client.get("/api/v1/trips?status=draft", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    # Only status="draft" should be returned (t3)
    statuses = [item["status"] for item in data["items"]]
    assert all(status == "draft" for status in statuses)
