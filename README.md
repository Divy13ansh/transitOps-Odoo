# TransitOps 🚛

**Smart Transport Operations Platform** — Hackathon Project

> Centralized platform for managing vehicle fleets, drivers, dispatching, maintenance, fuel, and analytics.

---

## Documentation Index

| Document | Description |
|---|---|
| [System Architecture](./docs/system_architecture.md) | Tech stack, component overview, RBAC, Docker setup |
| [Database Schema](./docs/database_schema.md) | All tables, enums, views, indexes, migration strategy |
| [API Design](./docs/api_design.md) | All endpoints, request/response shapes, status codes |
| [Implementation Plan](./docs/implementation_plan.md) | Phase-by-phase build plan with code patterns |
| [Business Rules](./docs/business_rules.md) | All 12 business rules, state machines, error messages |

---

## Quick Start

```bash
# Clone and set up environment
cp .env.example .env

# Start the stack
docker compose up --build

# Run migrations + seed
docker compose exec api alembic upgrade head
docker compose exec api python -m app.db.init_db

# API docs available at:
open http://localhost:8000/docs
```

---

## Architecture Summary

```
FastAPI (Python 3.12) → PostgreSQL 16
        ↑
  JWT Auth + RBAC (4 roles)
        ↑
  React/Vite SPA (TBD — awaiting mockups)
```

**8 DB entities** · **9 REST resource groups** · **12 enforced business rules** · **3 PostgreSQL views**

---

## Roles

| Role | Primary Responsibilities |
|---|---|
| `fleet_manager` | Full access to all resources |
| `dispatcher` | Create/dispatch trips, log fuel & expenses |
| `safety_officer` | Driver compliance, maintenance management |
| `financial_analyst` | Read-only reports, expense tracking, exports |

---

## Key Business Rules

1. Vehicle registration numbers are globally unique
2. `Retired` / `In Shop` vehicles never appear in dispatch selection
3. Drivers with expired licenses or `Suspended` status cannot be assigned
4. A vehicle/driver already `On Trip` cannot be assigned to another trip
5. Cargo weight is validated against vehicle max load capacity
6. Dispatching a trip atomically sets vehicle + driver → `On Trip`
7. Completing a trip atomically restores vehicle + driver → `Available`
8. Cancelling a dispatched trip restores vehicle + driver → `Available`
9. Creating a maintenance record automatically sets vehicle → `In Shop`
10. Closing maintenance restores vehicle → `Available` (unless `Retired`)
