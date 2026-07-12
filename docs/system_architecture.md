# TransitOps — System Architecture

## 1. Philosophy: Minimal Code, Maximum Value

> One language, one runtime, one database. No microservices until they're needed.

**Principle:** A single well-structured monolith is faster to build, easier to debug, and more than sufficient for hackathon + early production scale.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | Python 3.12 | Fastest iteration, rich ecosystem |
| **Framework** | FastAPI | Auto-generates OpenAPI docs, async-native, DI built-in |
| **ORM** | SQLAlchemy 2.x + Alembic | Declarative models, migration support |
| **Database** | PostgreSQL 16 | ACID, JSON support, views, triggers |
| **Auth** | `python-jose` (JWT) + `passlib` (bcrypt) | Stateless, RBAC-friendly |
| **Validation** | Pydantic v2 | Co-located with FastAPI, zero extra cost |
| **Scheduling** | APScheduler | License expiry reminders — no Celery overhead |
| **Export** | `pandas` (CSV) + `reportlab` (PDF) | Minimal deps |
| **Testing** | `pytest` + `httpx` | Fast async test client |
| **Container** | Docker + Docker Compose | One-command startup |
| **Frontend** | TBD (mockup-driven, React/Vite) | Decoupled SPA |

---

## 3. High-Level Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│              Browser SPA (React / Vite)                     │
│          Auth Token stored in httpOnly Cookie               │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / REST JSON
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI Application                       │
│   /auth  /vehicles  /drivers  /trips  /maintenance         │
│   /fuel-logs  /expenses  /dashboard  /reports              │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │          Dependency Injection Layer                  │  │
│   │   get_db() → get_current_user() → require_roles()   │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Service Layer                           │  │
│   │   trip_service  maintenance_service  report_service  │  │
│   └─────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ SQLAlchemy async
┌────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL 16                             │
│  Tables: users, roles, vehicles, drivers, trips,           │
│          maintenance_logs, fuel_logs, expenses             │
│  Views:  vw_fleet_kpis, vw_vehicle_cost_summary           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Project Directory Layout

```
transitops/
├── app/
│   ├── main.py                  # FastAPI app factory + lifespan
│   ├── core/
│   │   ├── config.py            # Settings via pydantic-settings (.env)
│   │   ├── security.py          # JWT encode/decode, bcrypt hashing
│   │   └── deps.py              # FastAPI Depends: db, current_user, RBAC
│   ├── db/
│   │   ├── base.py              # SQLAlchemy declarative Base
│   │   ├── session.py           # AsyncEngine + session factory
│   │   └── init_db.py           # Seed roles & default admin
│   ├── models/                  # ORM models (one file per entity)
│   │   ├── user.py
│   │   ├── vehicle.py
│   │   ├── driver.py
│   │   ├── trip.py
│   │   ├── maintenance_log.py
│   │   ├── fuel_log.py
│   │   └── expense.py
│   ├── schemas/                 # Pydantic v2 request/response DTOs
│   │   ├── auth.py
│   │   ├── vehicle.py
│   │   ├── driver.py
│   │   ├── trip.py
│   │   ├── maintenance_log.py
│   │   ├── fuel_log.py
│   │   └── expense.py
│   ├── api/v1/
│   │   ├── router.py            # Aggregates all sub-routers
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── vehicles.py
│   │   ├── drivers.py
│   │   ├── trips.py
│   │   ├── maintenance.py
│   │   ├── fuel_logs.py
│   │   ├── expenses.py
│   │   └── reports.py
│   └── services/                # Pure business logic (no HTTP)
│       ├── trip_service.py
│       ├── maintenance_service.py
│       └── report_service.py
├── alembic/
│   ├── env.py
│   └── versions/
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_trips.py
│   └── test_maintenance.py
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 5. Authentication & RBAC

### JWT Flow
```
POST /api/v1/auth/login  →  { access_token, token_type: "bearer" }
All subsequent requests:  Authorization: Bearer <token>
```

Token payload:
```json
{ "sub": "user_id", "role": "fleet_manager", "exp": 1234567890 }
```

### Roles & Permissions Matrix

| Resource | fleet_manager | dispatcher | safety_officer | financial_analyst |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Vehicles CRUD | ✅ | 📖 | 📖 | 📖 |
| Drivers CRUD | ✅ | 📖 | ✅ | 📖 |
| Trips create/dispatch | ✅ | ✅ | ❌ | ❌ |
| Trips view | ✅ | ✅ | ✅ | ✅ |
| Maintenance CRUD | ✅ | ❌ | ✅ | 📖 |
| Fuel Logs | ✅ | ✅ | ❌ | ✅ |
| Expenses | ✅ | ✅ | ❌ | ✅ |
| Reports & Export | ✅ | 📖 | 📖 | ✅ |

> 📖 = read-only, ✅ = full access, ❌ = no access

### RBAC Guard Pattern (FastAPI DI)
```python
# deps.py
def require_roles(*roles: str):
    def checker(user = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(403)
        return user
    return checker

# router usage — zero boilerplate per endpoint
@router.post("/", dependencies=[Depends(require_roles("fleet_manager", "dispatcher"))])
async def create_trip(...): ...
```

---

## 6. Key Design Decisions

### 6.1 State Machine in the Service Layer
All status transitions live exclusively in `services/` — never in routers or models. This ensures every business rule is enforced in one place.

```
Vehicle Status FSM:
  Available ──dispatch──► On Trip ──complete/cancel──► Available
  Available ──maintenance──► In Shop ──close──► Available
  Any ──retire──► Retired (terminal)

Driver Status FSM:
  Available ──dispatch──► On Trip ──complete/cancel──► Available
  Any ──suspend──► Suspended
  Suspended ──reinstate──► Available

Trip Status FSM:
  Draft ──dispatch──► Dispatched ──complete──► Completed
                              └──cancel──► Cancelled
```

### 6.2 Async SQLAlchemy 2.x
`AsyncSession` used throughout. All DB calls are `await`ed keeping the server non-blocking.

### 6.3 PostgreSQL Views for Dashboard KPIs
Heavy aggregation queries are pre-built as **database views** (`vw_fleet_kpis`, `vw_vehicle_cost_summary`). The dashboard endpoint does a single `SELECT * FROM vw_fleet_kpis` — no N+1 queries.

### 6.4 Cost Computed from Normalized Tables
Total cost = `SUM(fuel_logs.cost) + SUM(maintenance_logs.cost)` per vehicle. Never stored as a derived column — always computed fresh from normalized data.

### 6.5 Pre-flight Validation in Service Layer
Business rule violations (cargo > capacity, expired license, driver already On Trip) raise `HTTPException(422)` with structured error detail before any DB write is attempted.

---

## 7. Docker Compose (Dev)

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: transitops
      POSTGRES_USER: transit
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  api:
    build: .
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    env_file: .env
    ports: ["8000:8000"]
    depends_on: [db]
    volumes: [".:/app"]

volumes:
  pgdata:
```

**One command to start everything:** `docker compose up --build`

---

## 8. Auto-generated API Docs

FastAPI provides interactive docs out-of-the-box:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`
