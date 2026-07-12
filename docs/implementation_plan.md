# TransitOps — Implementation Plan

> **Goal:** Production-grade backend in ~6 hours. FE deferred to mockup review.
> **Stack:** FastAPI + PostgreSQL + SQLAlchemy 2.x + Docker

---

## Timeline Overview (8-Hour Hackathon)

| Phase | Time | Output |
|---|---|---|
| **Phase 0 — Scaffold** | 0:00 – 0:30 | Project skeleton, Docker, config |
| **Phase 1 — Data Layer** | 0:30 – 1:30 | Models, enums, migrations, seed |
| **Phase 2 — Auth** | 1:30 – 2:00 | Login, JWT, RBAC dependencies |
| **Phase 3 — Core CRUD** | 2:00 – 3:30 | Vehicles, Drivers endpoints |
| **Phase 4 — Trip Engine** | 3:30 – 4:30 | Trip lifecycle + state machine |
| **Phase 5 — Maintenance** | 4:30 – 5:00 | Maintenance workflow |
| **Phase 6 — Fuel & Expense** | 5:00 – 5:30 | Fuel logs + expenses |
| **Phase 7 — Dashboard & Reports** | 5:30 – 6:30 | KPIs, analytics, export |
| **Phase 8 — Polish & FE** | 6:30 – 8:00 | Tests, FE integration (mockup-based) |

---

## Phase 0 — Project Scaffold (30 min)

### Steps
1. Create directory structure (as per `system_architecture.md`)
2. Write `requirements.txt`
3. Write `docker-compose.yml` + `Dockerfile`
4. Write `.env.example`
5. Write `app/core/config.py` (pydantic-settings)
6. Write `app/main.py` with lifespan handler

### `requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.29.0
alembic==1.13.3
pydantic[email]==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
pandas==2.2.3
reportlab==4.2.5
apscheduler==3.10.4
pytest==8.3.3
httpx==0.27.2
pytest-asyncio==0.24.0
```

### `app/core/config.py` pattern
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()
```

### `app/main.py` pattern
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.db.session import engine
from app.db.base import Base
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: run migrations / seed
    yield
    # shutdown: close pool

app = FastAPI(title="TransitOps API", version="1.0.0", lifespan=lifespan)
app.include_router(api_router, prefix="/api/v1")
```

---

## Phase 1 — Data Layer (60 min)

### Steps
1. Define all SQLAlchemy models (models/*.py)
2. Create `alembic/env.py` with async engine config
3. `alembic revision --autogenerate -m "initial_schema"`
4. Write a second revision for views, enums, indexes
5. Write `app/db/init_db.py` seed script (roles + admin user)

### Key Model Pattern (SQLAlchemy 2.x)
```python
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import Enum as SAEnum
import uuid, enum

class VehicleStatus(str, enum.Enum):
    available = "available"
    on_trip   = "on_trip"
    in_shop   = "in_shop"
    retired   = "retired"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id:                  Mapped[uuid.UUID]  = mapped_column(primary_key=True, default=uuid.uuid4)
    registration_number: Mapped[str]        = mapped_column(unique=True, index=True)
    name:                Mapped[str]
    type:                Mapped[str]
    max_load_kg:         Mapped[float]
    odometer_km:         Mapped[float]      = mapped_column(default=0.0)
    acquisition_cost:    Mapped[float]      = mapped_column(default=0.0)
    status:              Mapped[VehicleStatus] = mapped_column(
                             SAEnum(VehicleStatus), default=VehicleStatus.available
                         )
    region:              Mapped[str | None]
    created_at:          Mapped[datetime]   = mapped_column(default=func.now())
    updated_at:          Mapped[datetime]   = mapped_column(default=func.now(), onupdate=func.now())
```

---

## Phase 2 — Auth (30 min)

### Steps
1. Write `app/core/security.py` — hash, verify, create_token, decode_token
2. Write `app/core/deps.py` — `get_db`, `get_current_user`, `require_roles`
3. Write `app/api/v1/auth.py` — `/login`, `/me`, `/users`
4. Write Pydantic schemas in `app/schemas/auth.py`

### `security.py` pattern
```python
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

pwd_ctx = CryptContext(schemes=["bcrypt"])

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = {**data, "exp": datetime.utcnow() + expires_delta}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

### `deps.py` pattern
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user

def require_roles(*roles: str):
    def checker(user = Depends(get_current_user)):
        if user.role.name not in roles:
            raise HTTPException(403, f"Requires one of: {roles}")
        return user
    return checker
```

---

## Phase 3 — Core CRUD: Vehicles & Drivers (90 min)

### Pattern for each resource:
1. Schema (`Create`, `Update`, `Response`, `ListResponse`)
2. Router with CRUD endpoints
3. Service functions for business logic

### Reusable Paginator
```python
# deps.py
class PaginationParams:
    def __init__(self, page: int = 1, page_size: int = 20):
        self.offset = (page - 1) * page_size
        self.limit = page_size
        self.page = page
        self.page_size = page_size
```

### Filter Pattern (Vehicles)
```python
@router.get("/", response_model=VehicleListResponse)
async def list_vehicles(
    status: VehicleStatus | None = None,
    type: str | None = None,
    region: str | None = None,
    search: str | None = None,
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Vehicle)
    if status:
        stmt = stmt.where(Vehicle.status == status)
    if type:
        stmt = stmt.where(Vehicle.type == type)
    if region:
        stmt = stmt.where(Vehicle.region.ilike(f"%{region}%"))
    if search:
        stmt = stmt.where(Vehicle.registration_number.ilike(f"%{search}%"))
    # paginate + return
```

### GET `/vehicles/available`
Shortcut endpoint for dispatch form dropdowns:
```python
stmt = select(Vehicle).where(Vehicle.status == VehicleStatus.available)
```

---

## Phase 4 — Trip Engine (60 min)

This is the **most critical** phase. All business rules live in `trip_service.py`.

### `services/trip_service.py`
```python
async def dispatch_trip(trip_id: UUID, db: AsyncSession) -> Trip:
    trip = await db.get(Trip, trip_id)
    vehicle = await db.get(Vehicle, trip.vehicle_id)
    driver = await db.get(Driver, trip.driver_id)

    # Pre-flight checks
    _assert(trip.status == TripStatus.draft,          "Trip is not in Draft status")
    _assert(vehicle.status == VehicleStatus.available, "Vehicle is not available")
    _assert(driver.status == DriverStatus.available,   "Driver is not available")
    _assert(driver.license_expiry >= date.today(),     "Driver license is expired")
    _assert(trip.cargo_weight_kg <= vehicle.max_load_kg,
            f"Cargo {trip.cargo_weight_kg}kg exceeds vehicle capacity {vehicle.max_load_kg}kg")

    # State transitions
    trip.status       = TripStatus.dispatched
    trip.dispatched_at = datetime.utcnow()
    vehicle.status    = VehicleStatus.on_trip
    driver.status     = DriverStatus.on_trip

    await db.commit()
    return trip

def _assert(condition: bool, message: str):
    if not condition:
        raise HTTPException(status_code=400, detail=message)
```

Same pattern for `complete_trip` and `cancel_trip`.

---

## Phase 5 — Maintenance Workflow (30 min)

### `services/maintenance_service.py`
```python
async def create_maintenance(payload: MaintenanceCreate, db: AsyncSession) -> MaintenanceLog:
    vehicle = await db.get(Vehicle, payload.vehicle_id)
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")

    log = MaintenanceLog(**payload.model_dump())
    db.add(log)
    vehicle.status = VehicleStatus.in_shop   # ← automatic status change
    await db.commit()
    return log

async def close_maintenance(log_id: UUID, payload: MaintenanceClose, db: AsyncSession):
    log = await db.get(MaintenanceLog, log_id)
    vehicle = await db.get(Vehicle, log.vehicle_id)

    log.status = MaintenanceStatus.closed
    log.completed_date = payload.completed_date
    if payload.final_cost is not None:
        log.cost = payload.final_cost

    if vehicle.status != VehicleStatus.retired:
        vehicle.status = VehicleStatus.available  # ← restore unless retired

    await db.commit()
    return log
```

---

## Phase 6 — Fuel Logs & Expenses (30 min)

Straightforward CRUD. `total_cost` is a PostgreSQL **generated column** — no application logic needed.

```python
# In fuel_log router
@router.post("/", response_model=FuelLogResponse, status_code=201)
async def create_fuel_log(payload: FuelLogCreate, db: AsyncSession = Depends(get_db), ...):
    log = FuelLog(**payload.model_dump())
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log
```

---

## Phase 7 — Dashboard & Reports (60 min)

### Dashboard KPIs — Single Query
```python
@router.get("/", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM vw_fleet_kpis"))
    kpi_row = result.mappings().one()

    # Drivers KPIs
    driver_stats = await db.execute(
        select(
            func.count().filter(Driver.status == "available").label("available"),
            func.count().filter(Driver.status == "on_trip").label("on_duty"),
        )
    )
    # Trip KPIs
    trip_stats = await db.execute(
        select(
            func.count().filter(Trip.status == "dispatched").label("active"),
            func.count().filter(Trip.status == "draft").label("pending"),
        )
    )
    return {**kpi_row, **driver_stats.mappings().one(), **trip_stats.mappings().one()}
```

### CSV Export Pattern
```python
@router.get("/export/csv")
async def export_csv(report: str, db: AsyncSession = Depends(get_db)):
    data = await report_service.get_report_data(report, db)
    df = pd.DataFrame(data)
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report}.csv"}
    )
```

---

## Phase 8 — Tests & Polish (90 min)

### Critical Test Cases
```python
# test_trips.py
async def test_dispatch_blocks_overloaded_cargo():
    # vehicle max_load = 500, cargo = 600
    # expect 400 with clear error message

async def test_dispatch_blocks_expired_license():
    # driver.license_expiry = yesterday
    # expect 400

async def test_dispatch_blocks_vehicle_in_shop():
    # vehicle.status = in_shop
    # expect 400

async def test_complete_trip_restores_statuses():
    # after complete: vehicle.status = available, driver.status = available

async def test_maintenance_sets_vehicle_in_shop():
    # after POST /maintenance: vehicle.status = in_shop

async def test_close_maintenance_restores_available():
    # after POST /maintenance/{id}/close: vehicle.status = available
```

### Seed Data for Demo
```python
# init_db.py — creates demo data for hackathon presentation
async def seed_demo_data(db: AsyncSession):
    # 5 vehicles in various states
    # 8 drivers
    # 3 active trips
    # 2 maintenance records
    # historical fuel logs for ROI charts
```

---

## Checklist: Mandatory Deliverables

- [ ] Authentication with RBAC (JWT + 4 roles)
- [ ] Vehicles CRUD + status transitions
- [ ] Drivers CRUD + eligibility checks
- [ ] Trip Management: Draft → Dispatch → Complete/Cancel
- [ ] All 9 business rules enforced in service layer
- [ ] Maintenance workflow (auto In Shop, auto restore)
- [ ] Fuel Log CRUD
- [ ] Expense CRUD
- [ ] Dashboard KPIs endpoint
- [ ] Reports: fuel efficiency, fleet utilization, operational cost, ROI
- [ ] CSV export
- [ ] Docker Compose (one-command start)
- [ ] Auto-generated Swagger docs

## Bonus Checklist

- [ ] PDF export (reportlab)
- [ ] License expiry scheduler (APScheduler)
- [ ] Dark mode in FE
- [ ] Charts in FE (Chart.js / Recharts)
- [ ] Vehicle document upload
