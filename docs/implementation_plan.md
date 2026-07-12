# TransitOps — Implementation Plan

> **Goal:** Production-grade backend in ~6 hours, GenAI differentiators in hours 2.5–5.
> **Stack:** FastAPI + PostgreSQL + SQLAlchemy 2.x + Docker
> **Team:** 2 Backend devs, 1 Frontend dev

---

## Priority Order (build in this sequence)

| Priority | Feature | Phase |
|---|---|---|
| **P0** | Auth + RBAC | Phase 2 |
| **P0** | Vehicle Registry (CRUD) | Phase 3 |
| **P0** | Driver Management (CRUD) | Phase 3 |
| **P0** | Trip Management + lifecycle + validation | Phase 4 |
| **P0** | Maintenance workflow | Phase 5 |
| **P0** | Fuel & Expense logging | Phase 6 |
| **P0** | Dashboard KPIs | Phase 7 |
| **P0** | Reports & Analytics + CSV export | Phase 7 |
| **P1** | Live Fleet Map | Phase 8 |
| **P1** | AI Dispatch Advisor | Phase 8 |
| **P1** | AI Daily Ops Briefing | Phase 8 |
| **P2** | "Ask TransitOps" Chat Widget | Phase 9 (if ahead) |
| **P3** | Control Tower — Autonomous Dispatch | Phase 9 (if ahead) |

> **Rule:** Do not start P2 or P3 until every P0 and P1 item is functional and demo-ready.

---

## Timeline Overview (6–7 Hour Team Sprint)

| Hour | Backend Dev 1 | Backend Dev 2 | Frontend Dev |
|---|---|---|---|
| 0–1 | Auth/RBAC + schema | Vehicle/Driver/Trip CRUD APIs | Login, Dashboard shell, nav |
| 1–2.5 | Trip lifecycle + status transitions | Maintenance + Fuel/Expense APIs + cost calc | Vehicle Registry, Drivers, Trip Dispatcher UI |
| 2.5–4 | Reports/analytics endpoints | Build `llm_service` + **AI Dispatch Advisor** endpoint | **Live Fleet Map** integration (Leaflet) |
| 4–5 | Bug fixes, edge cases, seed data | **AI Daily Briefing** endpoint | Wire AI Suggest button + briefing card into UI |
| 5–6 | *(if ahead)* Control Tower backend | *(if ahead)* Chat widget or Control Tower agent loop | *(if ahead)* Autopilot toggle + event feed UI |
| 6–7 | Full team: demo run-through, fallback checks, polish | | |

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
# Core
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
apscheduler==3.10.4

# P1 GenAI
openai==1.51.0              # works with Gemini's OpenAI-compat endpoint too

# Testing
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

## Phase 8 — GenAI & Fleet Map (P1) (60 min)

### Steps
1. Write `services/llm_service.py` — single async wrapper for all LLM calls
2. Seed `depots` table with hardcoded lat/lng (Gandhinagar, Ahmedabad, Vatva, Sanand, Mansa, Kalol)
3. Add `lat`, `lng`, `depot_id` to `Vehicle` model
4. Write `GET /fleet/locations` endpoint in `api/v1/fleet.py`
5. Write `POST /trips/suggest` — filter eligible candidates in `trip_service`, pass to `llm_service` for ranking
6. Write `POST /dashboard/briefing` — check `briefing_cache`, call LLM if stale, cache result
7. Pre-generate and hardcode **one fallback response** for each AI endpoint against seed data

### `services/llm_service.py` pattern
```python
import openai, json
from app.core.config import settings

client = openai.AsyncOpenAI(
    api_key=settings.LLM_API_KEY,
    base_url=settings.LLM_BASE_URL,  # swap to Gemini OpenAI-compat URL if needed
)

async def call_llm(system_prompt: str, context: dict) -> str:
    try:
        resp = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(context, default=str)},
            ],
            max_tokens=500,
        )
        return resp.choices[0].message.content
    except Exception:
        return None  # caller falls back to hardcoded response
```

### AI Dispatch Advisor pattern
```python
# api/v1/trips.py
@router.post("/suggest")
async def suggest_dispatch(payload: SuggestPayload, db=Depends(get_db)):
    # 1. Filter eligible vehicles + drivers using existing trip_service logic
    candidates = await trip_service.get_eligible_candidates(
        payload.cargo_weight_kg, payload.planned_distance_km, db
    )
    # 2. Call LLM to rank and explain (LLM never re-derives eligibility)
    result = await llm_service.call_llm(
        system_prompt=DISPATCH_ADVISOR_PROMPT,
        context={"candidates": candidates, **payload.model_dump()}
    )
    return result or DISPATCH_ADVISOR_FALLBACK
```

---

## Phase 9 — P2/P3 (only if ahead of schedule)

- **P2 — Ask TransitOps:** `POST /chat/ask` — stuff relevant table data as context, pass user question to `llm_service`
- **P3 — Control Tower:** Autopilot toggle + event feed. Reuses eligibility logic + AI Dispatch Advisor. Auto-dispatches only on unambiguous matches; escalates conflicts to pending queue.

---

## Checklist: Mandatory Deliverables (P0)

- [ ] Authentication with RBAC (JWT + 4 roles)
- [ ] Vehicles CRUD + status transitions
- [ ] Drivers CRUD + eligibility checks
- [ ] Trip Management: Draft → Dispatch → Complete/Cancel
- [ ] All 12 business rules enforced in service layer
- [ ] Maintenance workflow (auto In Shop, auto restore)
- [ ] Fuel Log CRUD
- [ ] Expense CRUD
- [ ] Settings: depot name, currency, distance unit + role-permission matrix view
- [ ] Dashboard KPIs endpoint
- [ ] Reports: fuel efficiency, fleet utilization, operational cost, ROI
- [ ] CSV export
- [ ] Docker Compose (one-command start)
- [ ] Auto-generated Swagger docs

## P1 Checklist (Differentiators)

- [ ] Live Fleet Map (`react-leaflet` + static depot lat/lng)
- [ ] `GET /fleet/locations` endpoint
- [ ] `POST /trips/suggest` — AI Dispatch Advisor with ranked candidates
- [ ] `POST /dashboard/briefing` — AI Daily Ops Briefing (cached 5 min)
- [ ] Fallback hardcoded responses for all AI endpoints

## P2/P3 Checklist (Stretch)

- [ ] Ask TransitOps chat widget (`POST /chat/ask`) — P2
- [ ] Control Tower autopilot toggle + event feed — P3
- [ ] Dark mode in FE
- [ ] APScheduler license expiry log alerts

---

## Demo Script (3–4 minutes)

1. **Login as Dispatcher** → Dashboard: point out AI Daily Briefing card + live map with colour-coded vehicle markers
2. **Trip Dispatcher:** create a trip, click **AI Suggest** → show ranked recommendation with one-line reasoning
3. **Validation demo:** try cargo weight > vehicle capacity → show hard block with inline error
4. **Dispatch** → vehicle/driver flip to On Trip live on the map
5. **Complete a trip** → **Maintenance:** create service record → vehicle auto-switches to In Shop, disappears from dispatch pool
6. **Reports:** show fuel efficiency / ROI numbers auto-calculated
7. *(If P3 built)* flip Autopilot on, fire pre-seeded trip requests, show one auto-approved + one correctly escalated on a real conflict
