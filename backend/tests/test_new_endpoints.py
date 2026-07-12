import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Vehicle, Driver, Trip, User, Role
from app.models.enums import VehicleStatus, DriverStatus, TripStatus
from app.services.trip_service import get_eligible_candidates
from app.core.security import hash_password


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def dispatcher_headers(client: AsyncClient, db: AsyncSession) -> dict:
    role_stmt = select_role = sa_stmt = "select role"
    from sqlalchemy.future import select
    role_stmt = select(Role).where(Role.name == "dispatcher")
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one()

    email = f"disp-{uuid.uuid4().hex[:6]}@test.com"
    password = "DispatcherPass123!"
    user = User(
        full_name="Test Dispatcher",
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
async def seed_data(db: AsyncSession):
    # Available vehicle
    v_avail = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:6].upper()}",
        name="Avail Truck",
        type="Heavy Truck",
        max_load_kg=Decimal("1000.0"),
        status=VehicleStatus.available,
        lat=Decimal("23.2156"),
        lng=Decimal("72.6369")
    )
    # Unavailable vehicle (in shop)
    v_shop = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:6].upper()}",
        name="Shop Truck",
        type="Heavy Truck",
        max_load_kg=Decimal("1500.0"),
        status=VehicleStatus.in_shop,
        lat=Decimal("23.0225"),
        lng=Decimal("72.5714")
    )
    db.add_all([v_avail, v_shop])

    # Available driver
    d_avail = Driver(
        full_name="Alex Valid",
        license_number=f"DL-{uuid.uuid4().hex[:10].upper()}",
        license_category="Class A",
        license_expiry=date.today() + timedelta(days=100),
        contact_number="+123456",
        safety_score=Decimal("10.0"),
        status=DriverStatus.available
    )
    # Unavailable driver (expired license)
    d_exp = Driver(
        full_name="Bob Expired",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        license_category="Class A",
        license_expiry=date.today() - timedelta(days=10),
        contact_number="+987654",
        safety_score=Decimal("8.0"),
        status=DriverStatus.available
    )
    db.add_all([d_avail, d_exp])
    await db.commit()

    await db.refresh(v_avail)
    await db.refresh(v_shop)
    await db.refresh(d_avail)
    await db.refresh(d_exp)

    return {
        "v_avail": v_avail,
        "v_shop": v_shop,
        "d_avail": d_avail,
        "d_exp": d_exp
    }


@pytest.mark.anyio
async def test_get_eligible_candidates_service(db: AsyncSession, seed_data: dict):
    res = await get_eligible_candidates(cargo_weight_kg=800.0, planned_distance_km=50.0, db=db)
    candidates = res["candidates"]
    excluded = res["excluded"]

    # Verify our seeded candidate is present
    assert any(c["vehicle_id"] == str(seed_data["v_avail"].id) and c["driver_id"] == str(seed_data["d_avail"].id) for c in candidates)
    # Verify shop truck (in_shop) and expired driver are not in eligible candidates
    assert not any(c["vehicle_id"] == str(seed_data["v_shop"].id) for c in candidates)
    assert not any(c["driver_id"] == str(seed_data["d_exp"].id) for c in candidates)
    assert "Shop Truck" in excluded
    assert "Bob Expired" in excluded


@pytest.mark.anyio
async def test_post_trips_suggest_dispatcher(client: AsyncClient, dispatcher_headers: dict, seed_data: dict):
    payload = {
        "source": " Gandhinagar",
        "destination": "Ahmedabad",
        "cargo_weight_kg": 800.0,
        "planned_distance_km": 50.0
    }
    response = await client.post(
        "/api/v1/trips/suggest",
        json=payload,
        headers=dispatcher_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    suggestions = data["suggestions"]
    assert len(suggestions) >= 1
    assert any(s["vehicle_id"] == str(seed_data["v_avail"].id) and s["driver_id"] == str(seed_data["d_avail"].id) for s in suggestions)
    assert "Shop Truck" in data["excluded"]


@pytest.mark.anyio
async def test_get_fleet_locations(client: AsyncClient, dispatcher_headers: dict, seed_data: dict):
    response = await client.get("/api/v1/fleet/locations", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    item = next((v for v in data if v["vehicle_id"] == str(seed_data["v_avail"].id)), None)
    assert item is not None
    assert item["registration_number"] == seed_data["v_avail"].registration_number
    assert item["lat"] == 23.2156
    assert item["lng"] == 72.6369


@pytest.mark.anyio
async def test_get_dashboard_metrics(client: AsyncClient, dispatcher_headers: dict, seed_data: dict):
    response = await client.get("/api/v1/dashboard", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_vehicles"] >= 2
    assert data["available_vehicles"] >= 1
    assert data["vehicles_in_shop"] >= 1


@pytest.mark.anyio
async def test_get_dashboard_active_trips(client: AsyncClient, dispatcher_headers: dict, seed_data: dict, db: AsyncSession):
    # Create active trip
    active_trip = Trip(
        vehicle_id=seed_data["v_avail"].id,
        driver_id=seed_data["d_avail"].id,
        source="Source",
        destination="Destination",
        planned_distance_km=Decimal("100.00"),
        cargo_weight_kg=Decimal("100.00"),
        status=TripStatus.dispatched,
        dispatched_at=datetime.now(timezone.utc)
    )
    db.add(active_trip)
    await db.commit()

    response = await client.get("/api/v1/dashboard/active-trips", headers=dispatcher_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["id"] == str(active_trip.id)


@pytest.mark.anyio
async def test_suggest_llm_failure_fallback(client: AsyncClient, dispatcher_headers: dict, seed_data: dict):
    from unittest.mock import patch
    payload = {
        "source": "Gandhinagar",
        "destination": "Ahmedabad",
        "cargo_weight_kg": 800.0,
        "planned_distance_km": 50.0
    }
    with patch("app.services.llm_service.call_llm") as mock_call:
        mock_call.return_value = None
        response = await client.post(
            "/api/v1/trips/suggest",
            json=payload,
            headers=dispatcher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert len(data["suggestions"]) >= 1
        # Check that suggestions are ordered by driver safety score (fallback logic)
        suggestions = data["suggestions"]
        assert suggestions[0]["vehicle_id"] == str(seed_data["v_avail"].id)
        assert suggestions[0]["driver_id"] == str(seed_data["d_avail"].id)


@pytest.mark.anyio
async def test_briefing_llm_failure_fallback(client: AsyncClient, dispatcher_headers: dict, db: AsyncSession):
    from app.models.briefing_cache import BriefingCache
    from unittest.mock import patch
    
    # Seed a stale briefing cache entry
    now = datetime.now(timezone.utc)
    stale_briefing = BriefingCache(
        content="Stale Operations Briefing",
        generated_at=now - timedelta(minutes=10),
        expires_at=now - timedelta(minutes=5)
    )
    db.add(stale_briefing)
    await db.commit()

    with patch("app.services.llm_service.call_llm") as mock_call:
        mock_call.return_value = None
        response = await client.post(
            "/api/v1/dashboard/briefing",
            headers=dispatcher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Stale Operations Briefing"
        assert data["cached"] is False

