import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from unittest.mock import patch

from app.models import Vehicle, Driver, Trip, Role, User
from app.models.enums import VehicleStatus, DriverStatus, TripStatus
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
async def dispatcher_headers(client: AsyncClient, db: AsyncSession) -> dict:
    return await create_user_with_role(db, client, "dispatcher")

@pytest.fixture
async def vehicle(db: AsyncSession) -> Vehicle:
    veh = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Autopilot Test Vehicle",
        type="Van",
        max_load_kg=Decimal("1000.00"),
        odometer_km=Decimal("5000.00"),
        acquisition_cost=Decimal("20000.00"),
        status=VehicleStatus.available,
        lat=Decimal("23.2156"),
        lng=Decimal("72.6369")
    )
    db.add(veh)
    await db.commit()
    await db.refresh(veh)
    return veh

@pytest.fixture
async def driver(db: AsyncSession) -> Driver:
    d = Driver(
        full_name="Autopilot Driver",
        license_number=f"DL-{uuid.uuid4().hex[:10].upper()}",
        license_category="LMV",
        license_expiry=date.today() + timedelta(days=50),
        contact_number="+91-1234567890",
        safety_score=Decimal("9.5"),
        status=DriverStatus.available
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return d

@pytest.mark.anyio
async def test_autopilot_toggle(client: AsyncClient, fleet_manager_headers: dict):
    # 1. Toggle autopilot on
    res = await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": True},
        headers=fleet_manager_headers
    )
    assert res.status_code == 200
    assert res.json()["enabled"] is True

    # 2. Get feed and verify it is enabled
    res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
    assert res.status_code == 200
    assert res.json()["autopilot_enabled"] is True

    # 3. Toggle autopilot off
    res = await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": False},
        headers=fleet_manager_headers
    )
    assert res.status_code == 200
    assert res.json()["enabled"] is False

    # 4. Get feed and verify it is disabled
    res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
    assert res.status_code == 200
    assert res.json()["autopilot_enabled"] is False

@pytest.mark.anyio
async def test_autopilot_single_unambiguous_candidate(
    client: AsyncClient,
    db: AsyncSession,
    fleet_manager_headers: dict,
    vehicle: Vehicle,
    driver: Driver
):
    # Isolate database state for autopilot tests:
    # 1. Retire all other vehicles
    await db.execute(
        update(Vehicle).where(Vehicle.id != vehicle.id).values(status=VehicleStatus.retired)
    )
    # 2. Suspend all other drivers
    await db.execute(
        update(Driver).where(Driver.id != driver.id).values(status=DriverStatus.suspended)
    )
    # 3. Delete any other draft trips
    await db.execute(
        delete(Trip).where(Trip.status == TripStatus.draft)
    )
    await db.commit()

    # 1. Create a draft trip that perfectly fits
    trip = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="Gandhinagar Depot",
        destination="Ahmedabad Hub",
        planned_distance_km=Decimal("35.00"),
        cargo_weight_kg=Decimal("500.00"),
        status=TripStatus.draft
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # 2. Enable autopilot
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": True},
        headers=fleet_manager_headers
    )

    # 3. Call feed to process requests
    res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
    assert res.status_code == 200
    data = res.json()

    # Find the event for this trip
    event = next((e for e in data["events"] if e.get("trip_id") == str(trip.id)), None)
    assert event is not None
    assert event["event_type"] == "auto_dispatched"
    assert event["status"] == "dispatched"
    assert "Single unambiguous candidate" in event["reason"]

    # Verify trip status in DB is now dispatched
    await db.refresh(trip)
    assert trip.status == TripStatus.dispatched
    assert trip.vehicle_id == vehicle.id
    assert trip.driver_id == driver.id

    # Verify vehicle and driver status are on_trip
    await db.refresh(vehicle)
    await db.refresh(driver)
    assert vehicle.status == VehicleStatus.on_trip
    assert driver.status == DriverStatus.on_trip

    # Reset autopilot state
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": False},
        headers=fleet_manager_headers
    )

@pytest.mark.anyio
async def test_autopilot_conflict_escalation(
    client: AsyncClient,
    db: AsyncSession,
    fleet_manager_headers: dict,
    vehicle: Vehicle,
    driver: Driver
):
    # Isolate database state for autopilot tests:
    # 1. Retire all other vehicles
    await db.execute(
        update(Vehicle).where(Vehicle.id != vehicle.id).values(status=VehicleStatus.retired)
    )
    # 2. Suspend all other drivers
    await db.execute(
        update(Driver).where(Driver.id != driver.id).values(status=DriverStatus.suspended)
    )
    # 3. Delete any other draft trips
    await db.execute(
        delete(Trip).where(Trip.status == TripStatus.draft)
    )
    await db.commit()

    # 1. Create a draft trip with cargo exceeding max capacity
    trip = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="Gandhinagar Depot",
        destination="Ahmedabad Hub",
        planned_distance_km=Decimal("35.00"),
        cargo_weight_kg=Decimal("5000.00"),
        status=TripStatus.draft
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # 2. Enable autopilot
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": True},
        headers=fleet_manager_headers
    )

    # 3. Call feed to process requests
    res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
    assert res.status_code == 200
    data = res.json()

    # Find the event for this trip
    event = next((e for e in data["events"] if e.get("trip_id") == str(trip.id)), None)
    assert event is not None
    assert event["event_type"] == "no_candidates"
    assert event["status"] == "rejected"

    # Verify trip status remains draft
    await db.refresh(trip)
    assert trip.status == TripStatus.draft

    # Reset autopilot state
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": False},
        headers=fleet_manager_headers
    )

@pytest.mark.anyio
async def test_autopilot_multiple_candidates_mocked_llm(
    client: AsyncClient,
    db: AsyncSession,
    fleet_manager_headers: dict,
    vehicle: Vehicle,
    driver: Driver
):
    # Create another available vehicle and driver so we have multiple candidates
    vehicle2 = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Autopilot Vehicle 2",
        type="Van",
        max_load_kg=Decimal("1200.00"),
        odometer_km=Decimal("5000.00"),
        acquisition_cost=Decimal("20000.00"),
        status=VehicleStatus.available,
        lat=Decimal("23.2156"),
        lng=Decimal("72.6369")
    )
    driver2 = Driver(
        full_name="Autopilot Driver 2",
        license_number=f"DL-{uuid.uuid4().hex[:10].upper()}",
        license_category="LMV",
        license_expiry=date.today() + timedelta(days=50),
        contact_number="+91-0987654321",
        safety_score=Decimal("9.0"),
        status=DriverStatus.available
    )
    db.add_all([vehicle2, driver2])
    await db.commit()
    await db.refresh(vehicle2)
    await db.refresh(driver2)

    # Isolate database state for autopilot tests:
    # 1. Retire all other vehicles
    await db.execute(
        update(Vehicle).where(Vehicle.id != vehicle.id, Vehicle.id != vehicle2.id).values(status=VehicleStatus.retired)
    )
    # 2. Suspend all other drivers
    await db.execute(
        update(Driver).where(Driver.id != driver.id, Driver.id != driver2.id).values(status=DriverStatus.suspended)
    )
    # 3. Delete any other draft trips
    await db.execute(
        delete(Trip).where(Trip.status == TripStatus.draft)
    )
    await db.commit()

    # Create draft trip
    trip = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="Gandhinagar Depot",
        destination="Ahmedabad Hub",
        planned_distance_km=Decimal("35.00"),
        cargo_weight_kg=Decimal("500.00"),
        status=TripStatus.draft
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # Enable autopilot
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": True},
        headers=fleet_manager_headers
    )

    # Case A: LLM says dispatch
    with patch("app.services.llm_service.call_llm") as mock_call:
        import json
        mock_response = {
            "action": "dispatch",
            "vehicle_id": str(vehicle2.id),
            "driver_id": str(driver2.id),
            "reason": "AI recommendation for Vehicle 2"
        }
        mock_call.return_value = json.dumps(mock_response)

        res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
        assert res.status_code == 200
        data = res.json()

        # Find the event
        event = next((e for e in data["events"] if e.get("trip_id") == str(trip.id)), None)
        assert event is not None
        assert event["event_type"] == "auto_dispatched"
        assert event["status"] == "dispatched"
        assert event["vehicle_id"] == str(vehicle2.id)
        assert event["driver_id"] == str(driver2.id)

        # Verify trip is dispatched in DB
        await db.refresh(trip)
        assert trip.status == TripStatus.dispatched
        assert trip.vehicle_id == vehicle2.id
        assert trip.driver_id == driver2.id

    # Create another draft trip to test escalation
    trip2 = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="Gandhinagar Depot",
        destination="Ahmedabad Hub",
        planned_distance_km=Decimal("35.00"),
        cargo_weight_kg=Decimal("400.00"),
        status=TripStatus.draft
    )
    db.add(trip2)
    await db.commit()
    await db.refresh(trip2)

    # Make vehicle2 and driver2 available again
    vehicle2.status = VehicleStatus.available
    driver2.status = DriverStatus.available
    await db.commit()

    # Case B: LLM says escalate
    with patch("app.services.llm_service.call_llm") as mock_call:
        import json
        mock_response = {
            "action": "escalate",
            "vehicle_id": None,
            "driver_id": None,
            "reason": "Ambiguous choices, please review"
        }
        mock_call.return_value = json.dumps(mock_response)

        res = await client.get("/api/v1/trips/autopilot/feed", headers=fleet_manager_headers)
        assert res.status_code == 200
        data = res.json()

        # Find event for trip2
        event2 = next((e for e in data["events"] if e.get("trip_id") == str(trip2.id)), None)
        assert event2 is not None
        assert event2["event_type"] == "escalated"
        assert event2["status"] == "pending"

        # Verify trip2 remains draft in DB
        await db.refresh(trip2)
        assert trip2.status == TripStatus.draft

    # Reset autopilot state
    await client.post(
        "/api/v1/trips/autopilot/toggle",
        json={"enabled": False},
        headers=fleet_manager_headers
    )
