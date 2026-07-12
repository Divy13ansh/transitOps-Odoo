import pytest
import uuid
import csv
from io import StringIO
from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import hash_password
from app.models import User, Role, Vehicle, Driver, Trip
from app.models.maintenance_log import MaintenanceLog
from app.models.enums import VehicleStatus, DriverStatus, TripStatus, MaintenanceStatus


@pytest.fixture
def anyio_backend():
    return "asyncio"


async def insert_fuel_log(
    db: AsyncSession,
    vehicle_id: uuid.UUID,
    trip_id: uuid.UUID | None,
    liters: float,
    cost_per_liter: float,
    odometer_at_fill: float | None = None
) -> uuid.UUID:
    log_id = uuid.uuid4()
    query = text(
        """
        INSERT INTO fuel_logs (id, vehicle_id, trip_id, liters, cost_per_liter, odometer_at_fill, filled_at)
        VALUES (:id, :vehicle_id, :trip_id, :liters, :cost_per_liter, :odometer_at_fill, CURRENT_DATE)
        """
    )
    await db.execute(
        query,
        {
            "id": log_id,
            "vehicle_id": vehicle_id,
            "trip_id": trip_id,
            "liters": Decimal(str(liters)),
            "cost_per_liter": Decimal(str(cost_per_liter)),
            "odometer_at_fill": Decimal(str(odometer_at_fill)) if odometer_at_fill is not None else None
        }
    )
    await db.commit()
    return log_id


@pytest.fixture
async def admin_headers(client: AsyncClient) -> dict:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": settings.default_admin_email, "password": settings.default_admin_password}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def financial_analyst_headers(client: AsyncClient, db: AsyncSession) -> dict:
    role_stmt = select(Role).where(Role.name == "financial_analyst")
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one()

    email = f"analyst-{uuid.uuid4().hex[:6]}@test.com"
    password = "AnalystPassword123!"
    analyst = User(
        full_name="Financial Analyst User",
        email=email,
        hashed_password=hash_password(password),
        role_id=role.id,
        is_active=True
    )
    db.add(analyst)
    await db.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
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
        name="Report Truck",
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


@pytest.fixture
async def driver(db: AsyncSession) -> Driver:
    drv = Driver(
        full_name="Jane Doe Test",
        license_number=f"DL-{uuid.uuid4().hex[:10].upper()}",
        license_category="Class A",
        license_expiry=date.today() + timedelta(days=365),
        contact_number="+15550299",
        safety_score=Decimal("9.8"),
        status=DriverStatus.available
    )
    db.add(drv)
    await db.commit()
    await db.refresh(drv)
    return drv


@pytest.mark.anyio
async def test_fuel_efficiency_empty_returns_empty_list(client: AsyncClient, admin_headers: dict, vehicle: Vehicle):
    response = await client.get(f"/api/v1/reports/fuel-efficiency?vehicle_id={vehicle.id}", headers=admin_headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_fuel_efficiency_with_data(client: AsyncClient, admin_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Seed completed trip
    trip = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="A",
        destination="B",
        planned_distance_km=Decimal("100.00"),
        actual_distance_km=Decimal("95.50"),
        cargo_weight_kg=Decimal("200.00"),
        status=TripStatus.completed,
        completed_at=datetime.now(timezone.utc)
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)

    # Seed fuel log linked to trip using raw SQL to bypass ORM GeneratedAlwaysError
    await insert_fuel_log(
        db=db,
        vehicle_id=vehicle.id,
        trip_id=trip.id,
        liters=25.00,
        cost_per_liter=2.00,
        odometer_at_fill=195.50
    )

    response = await client.get(f"/api/v1/reports/fuel-efficiency?vehicle_id={vehicle.id}", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["trip_id"] == str(trip.id)
    assert data[0]["actual_distance_km"] == 95.5
    assert data[0]["total_liters"] == 25.0
    assert data[0]["km_per_liter"] == round(95.5 / 25.0, 2)


@pytest.mark.anyio
async def test_operational_cost_zero_when_no_records(client: AsyncClient, financial_analyst_headers: dict, vehicle: Vehicle):
    response = await client.get("/api/v1/reports/operational-cost", headers=financial_analyst_headers)
    assert response.status_code == 200
    data = response.json()
    # Find our vehicle entry
    item = next((x for x in data if x["vehicle_id"] == str(vehicle.id)), None)
    assert item is not None
    assert item["total_fuel_cost"] == 0.0
    assert item["total_maintenance_cost"] == 0.0
    assert item["total_operational_cost"] == 0.0


@pytest.mark.anyio
async def test_operational_cost_sums_correctly(client: AsyncClient, financial_analyst_headers: dict, vehicle: Vehicle, db: AsyncSession):
    # Seed two fuel logs using raw SQL to bypass ORM GeneratedAlwaysError.
    await insert_fuel_log(db=db, vehicle_id=vehicle.id, trip_id=None, liters=20.00, cost_per_liter=2.50)  # 50.0
    await insert_fuel_log(db=db, vehicle_id=vehicle.id, trip_id=None, liters=10.00, cost_per_liter=3.00)  # 30.0

    # Seed two maintenance logs
    ml1 = MaintenanceLog(
        vehicle_id=vehicle.id,
        type="Oil Change",
        cost=Decimal("150.00"),
        status=MaintenanceStatus.closed
    )
    ml2 = MaintenanceLog(
        vehicle_id=vehicle.id,
        type="Tire Replacement",
        cost=Decimal("100.00"),
        status=MaintenanceStatus.closed
    )
    db.add_all([ml1, ml2])
    await db.commit()

    response = await client.get("/api/v1/reports/operational-cost", headers=financial_analyst_headers)
    assert response.status_code == 200
    data = response.json()
    item = next((x for x in data if x["vehicle_id"] == str(vehicle.id)), None)
    assert item is not None
    assert item["total_fuel_cost"] == 80.0
    assert item["total_maintenance_cost"] == 250.0
    assert item["total_operational_cost"] == 330.0


@pytest.mark.anyio
async def test_vehicle_roi_null_when_no_acquisition_cost(client: AsyncClient, financial_analyst_headers: dict, db: AsyncSession):
    # Create vehicle with acquisition_cost == 0
    veh = Vehicle(
        registration_number=f"REG-{uuid.uuid4().hex[:10].upper()}",
        name="Zero Cost Truck",
        type="Heavy Truck",
        max_load_kg=Decimal("1500.00"),
        odometer_km=Decimal("100.00"),
        acquisition_cost=Decimal("0.00"),
        status=VehicleStatus.available
    )
    db.add(veh)
    await db.commit()

    response = await client.get("/api/v1/reports/vehicle-roi", headers=financial_analyst_headers)
    assert response.status_code == 200
    data = response.json()
    item = next((x for x in data if x["vehicle_id"] == str(veh.id)), None)
    assert item is not None
    assert item["acquisition_cost"] == 0.0
    assert item["roi"] is None


@pytest.mark.anyio
async def test_vehicle_roi_calculation(client: AsyncClient, financial_analyst_headers: dict, vehicle: Vehicle, driver: Driver, db: AsyncSession):
    # Update vehicle acquisition cost to 10000.00
    vehicle.acquisition_cost = Decimal("10000.00")
    
    # Fuel cost = 200.00
    await insert_fuel_log(db=db, vehicle_id=vehicle.id, trip_id=None, liters=50.00, cost_per_liter=4.00)

    # Maintenance cost = 300.00
    ml = MaintenanceLog(
        vehicle_id=vehicle.id,
        type="Repair",
        cost=Decimal("300.00"),
        status=MaintenanceStatus.closed
    )
    db.add(ml)

    # Completed Trip Revenue = 1500.00
    trip = Trip(
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        source="A",
        destination="B",
        planned_distance_km=Decimal("100.00"),
        actual_distance_km=Decimal("100.00"),
        cargo_weight_kg=Decimal("200.00"),
        revenue=Decimal("1500.00"),
        status=TripStatus.completed,
        completed_at=datetime.now(timezone.utc)
    )
    db.add(trip)
    await db.commit()

    # ROI = (1500 - (200 + 300)) / 10000 = 1000 / 10000 = 0.1000
    response = await client.get("/api/v1/reports/vehicle-roi", headers=financial_analyst_headers)
    assert response.status_code == 200
    data = response.json()
    item = next((x for x in data if x["vehicle_id"] == str(vehicle.id)), None)
    assert item is not None
    assert item["roi"] == 0.1000


@pytest.mark.anyio
async def test_fleet_utilization_default_window(client: AsyncClient, financial_analyst_headers: dict):
    response = await client.get("/api/v1/reports/fleet-utilization", headers=financial_analyst_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 30
    for point in data:
        assert 0.0 <= point["utilization_pct"] <= 100.0


@pytest.mark.anyio
async def test_fleet_utilization_custom_range(client: AsyncClient, financial_analyst_headers: dict):
    today = date.today()
    start_date = today - timedelta(days=3)
    response = await client.get(
        f"/api/v1/reports/fleet-utilization?start_date={start_date}&end_date={today}",
        headers=financial_analyst_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4  # inclusive of start and end


@pytest.mark.anyio
async def test_fleet_utilization_invalid_range(client: AsyncClient, financial_analyst_headers: dict):
    today = date.today()
    start_date = today + timedelta(days=1)
    response = await client.get(
        f"/api/v1/reports/fleet-utilization?start_date={start_date}&end_date={today}",
        headers=financial_analyst_headers
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "start_date must be on or before end_date"


@pytest.mark.anyio
async def test_export_csv_vehicle_roi(client: AsyncClient, financial_analyst_headers: dict):
    response = await client.get("/api/v1/reports/export/csv?report=vehicle-roi", headers=financial_analyst_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=vehicle_roi.csv" in response.headers["content-disposition"]


@pytest.mark.anyio
async def test_export_csv_unknown_report(client: AsyncClient, financial_analyst_headers: dict):
    response = await client.get("/api/v1/reports/export/csv?report=not-a-report", headers=financial_analyst_headers)
    assert response.status_code == 400
    assert "Unknown report" in response.json()["detail"]


@pytest.mark.anyio
async def test_export_csv_empty_dataset(client: AsyncClient, financial_analyst_headers: dict):
    # Mock get_fuel_efficiency to return an empty list, ensuring zero rows dataset
    with patch("app.services.report_service.get_fuel_efficiency") as mock_get:
        mock_get.return_value = []
        response = await client.get("/api/v1/reports/export/csv?report=fuel-efficiency", headers=financial_analyst_headers)
        assert response.status_code == 200
        assert response.text == ""


@pytest.mark.anyio
async def test_reports_require_role_for_restricted_endpoints(
    client: AsyncClient, admin_headers: dict, dispatcher_headers: dict, financial_analyst_headers: dict
):
    # Restricted endpoints: /vehicle-roi, /operational-cost, /fleet-utilization
    # dispatcher -> should fail with 403
    for path in ["vehicle-roi", "operational-cost", "fleet-utilization"]:
        res = await client.get(f"/api/v1/reports/{path}", headers=dispatcher_headers)
        assert res.status_code == 403

    # /reports/fuel-efficiency -> should succeed for dispatcher
    res = await client.get("/api/v1/reports/fuel-efficiency", headers=dispatcher_headers)
    assert res.status_code == 200
