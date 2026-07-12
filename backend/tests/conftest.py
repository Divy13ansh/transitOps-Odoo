import ssl as _ssl
import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import create_access_token, hash_password
from app.models.driver import Driver, DriverStatus
from app.models.expense import Expense, ExpenseCategory
from app.models.briefing_cache import BriefingCache
from app.models.fuel_log import FuelLog
from app.models.maintenance_log import MaintenanceLog, MaintenanceStatus
from app.models.trip import Trip, TripStatus
from app.models.user import Role, User
from app.models.vehicle import Vehicle, VehicleStatus

import app.models  # noqa: F401

# ---------------------------------------------------------------------------
# Test engine with NullPool — immune to app lifespan disposal
# ---------------------------------------------------------------------------

_ssl_ctx = _ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = _ssl.CERT_NONE

_test_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    connect_args={"ssl": _ssl_ctx},
)
_test_session_factory = async_sessionmaker(_test_engine, class_=AsyncSession, expire_on_commit=False)

_created_ids: dict[str, list] = {
    "fuel_logs": [],
    "expenses": [],
    "maintenance_logs": [],
    "trips": [],
    "vehicles": [],
    "drivers": [],
    "users": [],
    "briefing_cache": [],
}


async def _override_get_db():
    async with _test_session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def _track_cleanup():
    """Reset tracking and clean up test-created rows after each test."""
    for v in _created_ids.values():
        v.clear()
    yield
    async with _test_session_factory() as session:
        vehicle_ids = list(_created_ids["vehicles"])
        driver_ids = list(_created_ids["drivers"])

        for log_id in _created_ids["fuel_logs"]:
            await session.execute(delete(FuelLog).where(FuelLog.id == log_id))
        for vid in vehicle_ids:
            await session.execute(delete(FuelLog).where(FuelLog.vehicle_id == vid))
        for log_id in _created_ids["expenses"]:
            await session.execute(delete(Expense).where(Expense.id == log_id))
        for vid in vehicle_ids:
            await session.execute(delete(Expense).where(Expense.vehicle_id == vid))
        for log_id in _created_ids["maintenance_logs"]:
            await session.execute(delete(MaintenanceLog).where(MaintenanceLog.id == log_id))
        for vid in vehicle_ids:
            await session.execute(delete(MaintenanceLog).where(MaintenanceLog.vehicle_id == vid))
        for log_id in _created_ids["trips"]:
            await session.execute(delete(Trip).where(Trip.id == log_id))
        for vid in vehicle_ids:
            await session.execute(delete(Trip).where(Trip.vehicle_id == vid))
        for did in driver_ids:
            await session.execute(delete(Trip).where(Trip.driver_id == did))
        for log_id in _created_ids["vehicles"]:
            await session.execute(delete(Vehicle).where(Vehicle.id == log_id))
        for did in driver_ids:
            await session.execute(delete(Driver).where(Driver.id == did))
        for log_id in _created_ids["users"]:
            await session.execute(delete(User).where(User.id == log_id))
        for cache_id in _created_ids["briefing_cache"]:
            await session.execute(delete(BriefingCache).where(BriefingCache.id == cache_id))
        await session.commit()


@pytest_asyncio.fixture
async def db():
    """Yield an async session bound to Neon DB."""
    async with _test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """AsyncClient wired to the FastAPI app with an overridden DB dependency."""
    from app.main import app

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Role & user helpers
# ---------------------------------------------------------------------------

async def _ensure_role(db: AsyncSession, name: str) -> Role:
    result = await db.execute(select(Role).where(Role.name == name))
    role = result.scalar_one_or_none()
    if role is None:
        role = Role(id=hash(name) % 32000, name=name)
        db.add(role)
        await db.flush()
    return role


async def create_user(
    db: AsyncSession,
    role_name: str = "fleet_manager",
    email: str | None = None,
) -> User:
    role = await _ensure_role(db, role_name)
    user = User(
        full_name=f"Test {role_name}",
        email=email or f"{role_name}_{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("secret"),
        role_id=role.id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    await db.commit()
    _created_ids["users"].append(user.id)
    return user


def auth_header(user: User) -> dict[str, str]:
    token = create_access_token(data={"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Seed-data fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def fleet_manager(db: AsyncSession) -> User:
    return await create_user(db, "fleet_manager", f"fleet_mgr_{uuid.uuid4().hex[:8]}@test.com")


@pytest_asyncio.fixture
async def dispatcher_user(db: AsyncSession) -> User:
    return await create_user(db, "dispatcher", f"dispatcher_{uuid.uuid4().hex[:8]}@test.com")


@pytest_asyncio.fixture
async def safety_officer(db: AsyncSession) -> User:
    return await create_user(db, "safety_officer", f"safety_{uuid.uuid4().hex[:8]}@test.com")


@pytest_asyncio.fixture
async def financial_analyst(db: AsyncSession) -> User:
    return await create_user(db, "financial_analyst", f"finance_{uuid.uuid4().hex[:8]}@test.com")


@pytest_asyncio.fixture
async def seed_vehicle(db: AsyncSession) -> Vehicle:
    v = Vehicle(
        registration_number=f"TEST-{uuid.uuid4().hex[:8]}",
        name=f"Test Vehicle {uuid.uuid4().hex[:6]}",
        type="Van",
        max_load_kg=500.0,
        odometer_km=10000.0,
        acquisition_cost=800000.0,
        status=VehicleStatus.available,
        region="Mumbai",
    )
    db.add(v)
    await db.flush()
    await db.refresh(v)
    await db.commit()
    _created_ids["vehicles"].append(v.id)
    return v


@pytest_asyncio.fixture
async def seed_vehicle_unavailable(db: AsyncSession) -> Vehicle:
    v = Vehicle(
        registration_number=f"TEST-{uuid.uuid4().hex[:8]}",
        name=f"Test Unavailable {uuid.uuid4().hex[:6]}",
        type="Truck",
        max_load_kg=1200.0,
        status=VehicleStatus.on_trip,
        region="Delhi",
    )
    db.add(v)
    await db.flush()
    await db.refresh(v)
    await db.commit()
    _created_ids["vehicles"].append(v.id)
    return v


@pytest_asyncio.fixture
async def seed_vehicle_small(db: AsyncSession) -> Vehicle:
    v = Vehicle(
        registration_number=f"TEST-{uuid.uuid4().hex[:8]}",
        name=f"Test Small {uuid.uuid4().hex[:6]}",
        type="Bike",
        max_load_kg=50.0,
        status=VehicleStatus.available,
        region="Pune",
    )
    db.add(v)
    await db.flush()
    await db.refresh(v)
    await db.commit()
    _created_ids["vehicles"].append(v.id)
    return v


@pytest_asyncio.fixture
async def seed_driver(db: AsyncSession) -> Driver:
    d = Driver(
        full_name=f"A Test Driver {uuid.uuid4().hex[:6]}",
        license_number=f"DL-{uuid.uuid4().hex[:8]}",
        license_category="LMV",
        license_expiry=date.today() + timedelta(days=365),
        contact_number="+91-9876543210",
        safety_score=9.2,
        status=DriverStatus.available,
    )
    db.add(d)
    await db.flush()
    await db.refresh(d)
    await db.commit()
    _created_ids["drivers"].append(d.id)
    return d


@pytest_asyncio.fixture
async def seed_driver_unavailable(db: AsyncSession) -> Driver:
    d = Driver(
        full_name=f"B Unavailable Driver {uuid.uuid4().hex[:6]}",
        license_number=f"DL-{uuid.uuid4().hex[:8]}",
        license_category="HMV",
        license_expiry=date.today() + timedelta(days=200),
        contact_number="+91-9876543211",
        safety_score=8.5,
        status=DriverStatus.on_trip,
    )
    db.add(d)
    await db.flush()
    await db.refresh(d)
    await db.commit()
    _created_ids["drivers"].append(d.id)
    return d


@pytest_asyncio.fixture
async def seed_driver_expired_license(db: AsyncSession) -> Driver:
    d = Driver(
        full_name=f"C Expired Driver {uuid.uuid4().hex[:6]}",
        license_number=f"DL-{uuid.uuid4().hex[:8]}",
        license_category="LMV",
        license_expiry=date.today() - timedelta(days=10),
        contact_number="+91-9876543212",
        safety_score=7.0,
        status=DriverStatus.available,
    )
    db.add(d)
    await db.flush()
    await db.refresh(d)
    await db.commit()
    _created_ids["drivers"].append(d.id)
    return d


@pytest_asyncio.fixture
async def seed_trip(
    db: AsyncSession,
    seed_vehicle: Vehicle,
    seed_driver: Driver,
) -> Trip:
    t = Trip(
        vehicle_id=seed_vehicle.id,
        driver_id=seed_driver.id,
        source=f"TestSrc-{uuid.uuid4().hex[:6]}",
        destination=f"TestDst-{uuid.uuid4().hex[:6]}",
        planned_distance_km=150.0,
        cargo_weight_kg=300.0,
        revenue=5000.0,
        status=TripStatus.draft,
    )
    db.add(t)
    await db.flush()
    await db.refresh(t)
    await db.commit()
    _created_ids["trips"].append(t.id)
    return t


@pytest_asyncio.fixture
async def seed_maintenance(
    db: AsyncSession,
    seed_vehicle: Vehicle,
) -> MaintenanceLog:
    ml = MaintenanceLog(
        vehicle_id=seed_vehicle.id,
        type=f"TestService-{uuid.uuid4().hex[:6]}",
        description="Routine service",
        cost=2500.0,
        status=MaintenanceStatus.open,
    )
    db.add(ml)
    await db.flush()
    await db.refresh(ml)
    await db.commit()
    _created_ids["maintenance_logs"].append(ml.id)
    return ml


@pytest_asyncio.fixture
async def seed_fuel_log(db: AsyncSession, seed_vehicle: Vehicle) -> FuelLog:
    fl = FuelLog(
        vehicle_id=seed_vehicle.id,
        liters=45.0,
        cost_per_liter=106.0,
        filled_at=date.today(),
    )
    db.add(fl)
    await db.flush()
    await db.refresh(fl)
    await db.commit()
    _created_ids["fuel_logs"].append(fl.id)
    return fl


@pytest_asyncio.fixture
async def seed_expense(db: AsyncSession, seed_vehicle: Vehicle) -> Expense:
    e = Expense(
        vehicle_id=seed_vehicle.id,
        category=ExpenseCategory.toll,
        amount=250.0,
        description=f"Test toll {uuid.uuid4().hex[:6]}",
        expense_date=date.today(),
    )
    db.add(e)
    await db.flush()
    await db.refresh(e)
    await db.commit()
    _created_ids["expenses"].append(e.id)
    return e
