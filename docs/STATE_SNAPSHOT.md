# TransitOps Backend State Snapshot

This snapshot documents the exact state of the backend before merging the teammate's branch.

## 1. Backend File Tree
```
backend/requirements.txt
backend/.env.example
backend/alembic.ini
backend/alembic/README
backend/alembic/env.py
backend/alembic/script.py.mako
backend/app/__init__.py
backend/app/main.py
backend/app/core/__init__.py
backend/app/core/config.py
backend/app/core/security.py
backend/app/core/deps.py
backend/app/db/__init__.py
backend/app/db/base.py
backend/app/db/session.py
backend/app/db/init_db.py
backend/app/models/__init__.py
backend/app/models/enums.py
backend/app/models/role.py
backend/app/models/user.py
backend/app/models/depot.py
backend/app/models/vehicle.py
backend/app/models/driver.py
backend/app/models/trip.py
backend/app/models/maintenance_log.py
backend/app/models/fuel_log.py
backend/app/models/expense.py
backend/app/models/briefing_cache.py
backend/app/models/dispatch_suggestion.py
backend/app/schemas/__init__.py
backend/app/schemas/auth.py
backend/app/api/__init__.py
backend/app/api/v1/__init__.py
backend/app/api/v1/router.py
backend/app/api/v1/auth.py
backend/tests/conftest.py
backend/tests/test_auth.py
```

---

## 2. SQLAlchemy Models (`backend/app/models/`)

### `Role` (table: `roles`)
* **Columns**:
  * `id`: `SmallInteger`, Primary Key
  * `name`: `String(30)`, Unique, Not Null
* **Relationships**:
  * None

### `User` (table: `users`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `full_name`: `String(100)`, Not Null
  * `email`: `String(255)`, Unique, Not Null
  * `hashed_password`: `String(255)`, Not Null
  * `role_id`: `SmallInteger`, ForeignKey `roles.id`, Not Null
  * `is_active`: `Boolean`, default `True`
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
* **Relationships**:
  * `role`: `relationship("Role")`

### `Depot` (table: `depots`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `name`: `String(100)`, Unique, Not Null
  * `lat`: `Numeric(9, 6)`, Not Null
  * `lng`: `Numeric(9, 6)`, Not Null
  * `region`: `String(100)`, Nullable
* **Relationships**:
  * None

### `Vehicle` (table: `vehicles`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `registration_number`: `String(20)`, Unique, Not Null
  * `name`: `String(100)`, Not Null
  * `type`: `String(50)`, Not Null
  * `max_load_kg`: `Numeric(10, 2)`, Not Null
  * `odometer_km`: `Numeric(10, 2)`, default `0`
  * `acquisition_cost`: `Numeric(12, 2)`, default `0`
  * `status`: `Enum(VehicleStatus, name="vehicle_status", create_type=False)`, default `VehicleStatus.available`
  * `region`: `String(100)`, Nullable
  * `lat`: `Numeric(9, 6)`, Nullable
  * `lng`: `Numeric(9, 6)`, Nullable
  * `depot_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `depots.id`, Nullable
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
  * `updated_at`: `DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`
* **Relationships**:
  * `depot`: `relationship("Depot")`

### `Driver` (table: `drivers`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `full_name`: `String(100)`, Not Null
  * `license_number`: `String(50)`, Unique, Not Null
  * `license_category`: `String(10)`, Not Null
  * `license_expiry`: `Date`, Not Null
  * `contact_number`: `String(20)`, Not Null
  * `safety_score`: `Numeric(3, 1)`, default `10.0`
  * `status`: `Enum(DriverStatus, name="driver_status", create_type=False)`, default `DriverStatus.available`
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
  * `updated_at`: `DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`
* **Relationships**:
  * None

### `Trip` (table: `trips`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `vehicle_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `vehicles.id`, Not Null
  * `driver_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `drivers.id`, Not Null
  * `source`: `String(200)`, Not Null
  * `destination`: `String(200)`, Not Null
  * `planned_distance_km`: `Numeric(10, 2)`, Not Null
  * `actual_distance_km`: `Numeric(10, 2)`, Nullable
  * `cargo_weight_kg`: `Numeric(10, 2)`, Not Null
  * `revenue`: `Numeric(12, 2)`, default `0`
  * `status`: `Enum(TripStatus, name="trip_status", create_type=False)`, default `TripStatus.draft`
  * `dispatched_at`: `DateTime(timezone=True)`, Nullable
  * `completed_at`: `DateTime(timezone=True)`, Nullable
  * `cancelled_at`: `DateTime(timezone=True)`, Nullable
  * `notes`: `Text`, Nullable
  * `created_by`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `users.id`, Nullable
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
  * `updated_at`: `DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`
* **Relationships**:
  * `vehicle`: `relationship("Vehicle")`
  * `driver`: `relationship("Driver")`
  * `creator`: `relationship("User")`

### `MaintenanceLog` (table: `maintenance_logs`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `vehicle_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `vehicles.id`, Not Null
  * `type`: `String(100)`, Not Null
  * `description`: `Text`, Nullable
  * `cost`: `Numeric(12, 2)`, default `0`
  * `odometer_at_service`: `Numeric(10, 2)`, Nullable
  * `status`: `Enum(MaintenanceStatus, name="maintenance_status", create_type=False)`, default `MaintenanceStatus.open`
  * `scheduled_date`: `Date`, Nullable
  * `completed_date`: `Date`, Nullable
  * `created_by`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `users.id`, Nullable
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
  * `updated_at`: `DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`
* **Relationships**:
  * `vehicle`: `relationship("Vehicle")`
  * `creator`: `relationship("User")`

### `FuelLog` (table: `fuel_logs`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `vehicle_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `vehicles.id`, Not Null
  * `trip_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `trips.id`, Nullable
  * `liters`: `Numeric(8, 2)`, Not Null
  * `cost_per_liter`: `Numeric(8, 2)`, Not Null
  * `total_cost`: `Numeric(10, 2)`, server_default `None` (Read-only generated column)
  * `odometer_at_fill`: `Numeric(10, 2)`, Nullable
  * `filled_at`: `Date`, default `date.today`, server_default `func.current_date()`
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
* **Relationships**:
  * `vehicle`: `relationship("Vehicle")`
  * `trip`: `relationship("Trip")`

### `Expense` (table: `expenses`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `vehicle_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `vehicles.id`, Not Null
  * `trip_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `trips.id`, Nullable
  * `category`: `Enum(ExpenseCategory, name="expense_category", create_type=False)`, Not Null
  * `amount`: `Numeric(12, 2)`, Not Null
  * `description`: `Text`, Nullable
  * `expense_date`: `Date`, default `date.today`, server_default `func.current_date()`
  * `created_by`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `users.id`, Nullable
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
* **Relationships**:
  * `vehicle`: `relationship("Vehicle")`
  * `trip`: `relationship("Trip")`
  * `creator`: `relationship("User")`

### `BriefingCache` (table: `briefing_cache`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `content`: `Text`, Not Null
  * `generated_at`: `DateTime(timezone=True)`, server_default `func.now()`
  * `expires_at`: `DateTime(timezone=True)`, Not Null
* **Relationships**:
  * None

### `DispatchSuggestion` (table: `dispatch_suggestions`)
* **Columns**:
  * `id`: `UUID` (PostgreSQL `as_uuid=True`), Primary Key, default `uuid.uuid4`
  * `trip_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `trips.id`, Nullable
  * `suggested_vehicle_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `vehicles.id`, Nullable
  * `suggested_driver_id`: `UUID` (PostgreSQL `as_uuid=True`), ForeignKey `drivers.id`, Nullable
  * `reason`: `Text`, Nullable
  * `accepted`: `Boolean`, Nullable
  * `created_at`: `DateTime(timezone=True)`, server_default `func.now()`
* **Relationships**:
  * `trip`: `relationship("Trip")`
  * `suggested_vehicle`: `relationship("Vehicle", foreign_keys=[suggested_vehicle_id])`
  * `suggested_driver`: `relationship("Driver", foreign_keys=[suggested_driver_id])`

---

## 3. Enums (`backend/app/models/enums.py`)
* `VehicleStatus`: `available`, `on_trip`, `in_shop`, `retired`
* `DriverStatus`: `available`, `on_trip`, `off_duty`, `suspended`
* `TripStatus`: `draft`, `dispatched`, `completed`, `cancelled`
* `MaintenanceStatus`: `open`, `closed`
* `ExpenseCategory`: `toll`, `parking`, `repair`, `insurance`, `other`

---

## 4. Auth & RBAC Design Decisions
* **JWT Payload Shape**:
  `{"sub": user_id, "role": role_name, "exp": ...}`
* **RBAC Guard Pattern**:
  `require_roles(*roles)` dependency pattern returns a dependency checking function checking `user.role.name` against allowed `roles`. Usage: `Depends(require_roles("fleet_manager"))`
* **Version Pins**:
  Pinned `bcrypt<4.0.0` (installed `3.2.2`) in the virtual environment to ensure backward compatibility with `passlib[bcrypt]` 1.7.4's internal bug detection code.
* **PostgreSQL Enums Guard**:
  Passed `create_type=False` on every `PgEnum` column instantiation so SQLAlchemy does not attempt to create PostgreSQL types that already exist in NeonDB.

---

## 5. Endpoints Implemented

| Method | Path | Required Role(s) | Request Shape | Response Shape |
|---|---|---|---|---|
| `GET` | `/health` | None | None | `{"status": "ok"}` |
| `POST` | `/api/v1/auth/login` | None | `LoginRequest` (`email`, `password`) | `TokenResponse` (`access_token`, `token_type`) |
| `GET` | `/api/v1/auth/me` | Logged In | None | `UserResponse` (`id`, `full_name`, `email`, `role`, `is_active`) |
| `POST` | `/api/v1/auth/users` | `fleet_manager` | `UserCreateRequest` (`full_name`, `email`, `password`, `role`) | `UserResponse` (`id`, `full_name`, `email`, `role`, `is_active`) |

---

## 6. Test Suite Status
Verbose run `pytest -v` output:
```
tests/test_auth.py::test_health_check PASSED                             [ 25%]
tests/test_auth.py::test_admin_login PASSED                              [ 50%]
tests/test_auth.py::test_get_me PASSED                                   [ 75%]
tests/test_auth.py::test_create_user_and_rbac PASSED                     [100%]
======================== 4 passed, 6 warnings in 34.78s ========================
```

---

## 7. Alembic Setup
* `alembic.ini` and `alembic/env.py` exist in the backend folder.
* Configured dynamically: `env.py` reads `DATABASE_URL` from the application settings (replacing `postgresql+asyncpg` with a sync psycopg2/postgresql schema).
* No migrations have been generated or run. Live tables exist in NeonDB.

---

## 8. Known Deviations
* Pinned `bcrypt==3.2.2` and manually installed `email-validator` and `greenlet` in the local virtual environment to resolve passlib compatibility and SQLAlchemy 2.0 asyncpg requirements.
