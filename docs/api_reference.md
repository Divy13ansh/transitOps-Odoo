# TransitOps — Complete API Reference & Call Trace

> **Base URL:** `http://localhost:8000/api/v1`  
> **Auth:** All endpoints require `Authorization: Bearer <token>` **except** `POST /auth/login` and `GET /health`  
> **Content-Type:** `application/json`  
> **Interactive Docs:** `http://localhost:8000/docs` (Swagger UI)

---

## Quick Navigation

| Module | Endpoints |
|---|---|
| [Health](#health) | GET /health |
| [Auth](#auth) | login, me, create user |
| [Vehicles](#vehicles) | CRUD + available + cost-summary |
| [Drivers](#drivers) | CRUD + available + expiring-licenses |
| [Trips](#trips) | CRUD + dispatch + complete + cancel + suggest |
| [Maintenance](#maintenance) | CRUD + close |
| [Fuel Logs](#fuel-logs) | list + create + get + delete |
| [Expenses](#expenses) | list + create + get + delete |
| [Dashboard](#dashboard) | KPIs + active-trips + AI briefing |
| [Reports](#reports) | fuel-efficiency + utilization + cost + ROI + CSV export |
| [Fleet Map](#fleet-map) | vehicle locations |
| [Control Tower](#control-tower) | autopilot toggle + feed |
| [Chat](#chat) | Ask TransitOps AI |

---

## Enums Reference

```
VehicleStatus:   available | on_trip | in_shop | retired
DriverStatus:    available | on_trip | off_duty | suspended
TripStatus:      draft | dispatched | completed | cancelled
MaintenanceStatus: open | closed
ExpenseCategory: toll | parking | repair | insurance | other
```

---

## Common Patterns

### Authentication Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Paginated Response Shape
```json
{
  "items": [...],
  "total": 48,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

### Pagination Query Params
| Param | Type | Default | Max |
|---|---|---|---|
| `page` | int | 1 | — |
| `page_size` | int | 20 | 100 |

### Error Response Shape
```json
{ "detail": "Human-readable error message" }
```

### HTTP Status Code Reference
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE success) |
| 400 | Business rule violation or bad input |
| 401 | Missing/invalid/expired token |
| 403 | Role not permitted for this action |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate registration number) |
| 422 | Pydantic validation error |

---

## Health

### `GET /health`
**Auth:** None  
**Roles:** None  
**File:** `app/main.py` → `health()`

**Response:**
```json
{ "status": "ok" }
```

---

## Auth

### `POST /api/v1/auth/login`
**Auth:** None  
**Roles:** None  
**File:** `app/api/v1/auth.py` → `login()`  
**Service calls:** `core/security.py → verify_password()`, `core/security.py → create_access_token()`

**Request Body:**
```json
{
  "email": "admin@transitops.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 401 | `"Invalid email or password"` | Email not found, wrong password, or inactive account |

**Token payload:** `{ "sub": "<user_uuid>", "role": "fleet_manager", "exp": <unix_ts> }`  
**Token TTL:** 120 minutes (configurable via `jwt_expire_minutes` in `.env`)

---

### `GET /api/v1/auth/me`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/auth.py` → `get_me()`  
**Service calls:** `core/deps.py → get_current_user()`

**Response `200`:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "full_name": "Alex Fernandes",
  "email": "alex@transitops.com",
  "role": "dispatcher",
  "is_active": true
}
```

---

### `POST /api/v1/auth/users`
**Auth:** Required  
**Roles:** `fleet_manager` only  
**File:** `app/api/v1/auth.py` → `create_user()`

**Request Body:**
```json
{
  "full_name": "Raj Patel",
  "email": "raj@transitops.com",
  "password": "secure_password",
  "role": "dispatcher"
}
```

> Valid `role` values: `fleet_manager` | `dispatcher` | `safety_officer` | `financial_analyst`

**Response `201`:**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "full_name": "Raj Patel",
  "email": "raj@transitops.com",
  "role": "dispatcher",
  "is_active": true
}
```

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Invalid role"` | Role name doesn't match any seeded role |
| 409 | `"A user with this email already exists"` | Email duplicate |

---

## Vehicles

### `GET /api/v1/vehicles/`
**Auth:** Required  
**Roles:** Any authenticated  
**File:** `app/api/v1/vehicles.py` → `list_vehicles()`  
**No service layer — direct DB query**

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `status` | VehicleStatus | Filter by status |
| `type` | string | Filter by vehicle type (e.g. `Van`, `Truck`) |
| `region` | string | ILIKE filter on region |
| `search` | string | ILIKE filter on registration_number |
| `sort_by` | string | Column name to sort by (default: `created_at`) |
| `sort_order` | `asc`\|`desc` | Sort direction (default: `asc`) |
| `page` | int | Page number |
| `page_size` | int | Items per page (max 100) |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "registration_number": "GJ-01-AA-0001",
      "name": "Van-05",
      "type": "Van",
      "max_load_kg": 500.0,
      "odometer_km": 12340.0,
      "acquisition_cost": 850000.0,
      "status": "available",
      "region": "Ahmedabad North",
      "lat": 23.2156,
      "lng": 72.6369,
      "depot_id": "uuid-or-null",
      "created_at": "2026-07-12T08:00:00Z",
      "updated_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 24,
  "page": 1,
  "page_size": 20,
  "pages": 2
}
```

---

### `GET /api/v1/vehicles/available`
**Auth:** Required  
**Roles:** `dispatcher`, `fleet_manager`  
**File:** `app/api/v1/vehicles.py` → `list_available_vehicles()`  
**Purpose:** Populates vehicle dropdown in Trip Dispatcher UI

**Response `200`:** `list[VehicleResponse]` — only vehicles with `status = "available"`

---

### `GET /api/v1/vehicles/{vehicle_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/vehicles.py` → `get_vehicle()`

**Path Params:** `vehicle_id` (UUID)

**Response `200`:** Single `VehicleResponse`

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Vehicle not found"` |

---

### `GET /api/v1/vehicles/{vehicle_id}/cost-summary`
**Auth:** Required  
**Roles:** `fleet_manager`, `financial_analyst`  
**File:** `app/api/v1/vehicles.py` → `get_vehicle_cost_summary()`  
**DB:** Reads from PostgreSQL view `vw_vehicle_cost_summary`

**Response `200`:**
```json
{
  "vehicle_id": "uuid",
  "registration_number": "GJ-01-AA-0001",
  "name": "Van-05",
  "acquisition_cost": 850000.0,
  "total_fuel_cost": 45200.0,
  "total_maintenance_cost": 12300.0,
  "total_operational_cost": 57500.0,
  "total_revenue": 210000.0,
  "roi": 0.1794
}
```

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Vehicle not found"` |

---

### `POST /api/v1/vehicles/`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/vehicles.py` → `create_vehicle()`

**Request Body:**
```json
{
  "registration_number": "GJ-01-AA-0001",
  "name": "Van-05",
  "type": "Van",
  "max_load_kg": 500.0,
  "odometer_km": 0.0,
  "acquisition_cost": 850000.0,
  "region": "Ahmedabad North",
  "lat": 23.2156,
  "lng": 72.6369,
  "depot_id": "uuid-or-null"
}
```

> `lat`, `lng`, `depot_id` are optional. `status` defaults to `available`.

**Response `201`:** `VehicleResponse`

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 409 | `"Vehicle with registration '...' already exists"` | BR-01: Duplicate registration number |

---

### `PATCH /api/v1/vehicles/{vehicle_id}`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/vehicles.py` → `update_vehicle()`

**Request Body:** Any subset of vehicle fields (all optional):
```json
{
  "name": "Van-05 Updated",
  "odometer_km": 15000.0,
  "status": "retired",
  "region": "Surat South"
}
```

**Response `200`:** Updated `VehicleResponse`

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Vehicle not found"` |
| 409 | Duplicate registration number on update |

---

### `DELETE /api/v1/vehicles/{vehicle_id}`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/vehicles.py` → `delete_vehicle()`  
**⚠️ Soft delete — sets `status = "retired"`, never removes from DB**

**Response `200`:** `VehicleResponse` with `status: "retired"`

---

## Drivers

### `GET /api/v1/drivers/`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/drivers.py` → `list_drivers()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `status` | DriverStatus | Filter by status |
| `license_category` | string | Filter by license category |
| `search` | string | ILIKE filter on `full_name` |
| `sort_by` | string | Column to sort (default: `created_at`) |
| `sort_order` | `asc`\|`desc` | Sort direction |
| `page`, `page_size` | int | Pagination |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "full_name": "Alex Fernandes",
      "license_number": "DL-20230001234",
      "license_category": "LMV",
      "license_expiry": "2027-06-30",
      "contact_number": "+91-9876543210",
      "safety_score": 9.2,
      "status": "available",
      "created_at": "2026-07-12T08:00:00Z",
      "updated_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

---

### `GET /api/v1/drivers/available`
**Auth:** Required  
**Roles:** `dispatcher`, `fleet_manager`  
**File:** `app/api/v1/drivers.py` → `list_available_drivers()`  
**Purpose:** Populates driver dropdown in Trip Dispatcher UI  
**Filter logic:** `status = "available"` AND `license_expiry >= today`

**Response `200`:** `list[DriverResponse]`

---

### `GET /api/v1/drivers/expiring-licenses`
**Auth:** Required  
**Roles:** `safety_officer`, `fleet_manager`  
**File:** `app/api/v1/drivers.py` → `list_expiring_licenses()`  
**Filter logic:** `license_expiry BETWEEN today AND today + 30 days`

**Response `200`:** `list[DriverResponse]`

---

### `GET /api/v1/drivers/{driver_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/drivers.py` → `get_driver()`

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Driver not found"` |

---

### `POST /api/v1/drivers/`
**Auth:** Required  
**Roles:** `fleet_manager`, `safety_officer`  
**File:** `app/api/v1/drivers.py` → `create_driver()`

**Request Body:**
```json
{
  "full_name": "Alex Fernandes",
  "license_number": "DL-20230001234",
  "license_category": "LMV",
  "license_expiry": "2027-06-30",
  "contact_number": "+91-9876543210",
  "safety_score": 9.2
}
```

> `safety_score` defaults to `10.0` if omitted. `status` defaults to `available`.

**Response `201`:** `DriverResponse`

**Errors:**
| Status | Detail |
|---|---|
| 409 | `"Driver with license number '...' already exists"` |

---

### `PATCH /api/v1/drivers/{driver_id}`
**Auth:** Required  
**Roles:** `fleet_manager`, `safety_officer`  
**File:** `app/api/v1/drivers.py` → `update_driver()`

**Request Body:** Any subset of driver fields (all optional):
```json
{
  "safety_score": 8.5,
  "status": "off_duty",
  "license_expiry": "2028-12-31"
}
```

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Driver not found"` |
| 409 | Duplicate license number on update |

---

### `DELETE /api/v1/drivers/{driver_id}`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/drivers.py` → `delete_driver()`  
**⚠️ Soft delete — sets `status = "suspended"`, never removes from DB**

**Response `200`:** `DriverResponse` with `status: "suspended"`

---

## Trips

### `GET /api/v1/trips`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/trips.py` → `list_trips_endpoint()`  
**Service:** `trip_service.list_trips()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `status` | TripStatus | Filter by status |
| `vehicle_id` | UUID | Filter by vehicle |
| `driver_id` | UUID | Filter by driver |
| `page`, `page_size` | int | Pagination |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "driver_id": "uuid",
      "source": "Gandhinagar Depot",
      "destination": "Ahmedabad Hub",
      "planned_distance_km": 35.0,
      "actual_distance_km": null,
      "cargo_weight_kg": 450.0,
      "revenue": 12000.0,
      "status": "draft",
      "dispatched_at": null,
      "completed_at": null,
      "cancelled_at": null,
      "notes": "Fragile goods",
      "created_by": "uuid",
      "created_at": "2026-07-12T08:00:00Z",
      "updated_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

---

### `POST /api/v1/trips`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `create_trip_endpoint()`  
**Service:** `trip_service.create_trip()`

**Business Rules Enforced:**
- Validates `cargo_weight_kg ≤ vehicle.max_load_kg`
- Does NOT validate vehicle/driver availability at creation time — only at dispatch

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "driver_id": "uuid",
  "source": "Gandhinagar Depot",
  "destination": "Ahmedabad Hub",
  "planned_distance_km": 35.0,
  "cargo_weight_kg": 450.0,
  "revenue": 12000.0,
  "notes": "Fragile goods"
}
```

**Response `201`:** `TripResponse` with `status: "draft"`

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Cargo X kg exceeds vehicle max capacity Y kg"` | BR-05: Overloaded |
| 404 | `"Vehicle {id} not found"` | Invalid vehicle_id |
| 404 | `"Driver {id} not found"` | Invalid driver_id |

---

### `GET /api/v1/trips/{trip_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/trips.py` → `get_trip_endpoint()`  
**Service:** `trip_service.get_trip()`

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Trip {id} not found"` |

---

### `PATCH /api/v1/trips/{trip_id}`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `update_trip_endpoint()`  
**Service:** `trip_service.update_trip_draft()`  
**⚠️ Only works on trips in `draft` status**

**Request Body:** Any subset:
```json
{
  "source": "Updated Source",
  "destination": "Updated Destination",
  "cargo_weight_kg": 400.0,
  "revenue": 15000.0,
  "notes": "Updated notes"
}
```

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Trip can only be updated while in draft status (current status: ...)"` | Trip not in draft |
| 400 | `"Cargo X kg exceeds vehicle max capacity Y kg"` | Capacity violation |
| 404 | Trip/vehicle/driver not found |

---

### `POST /api/v1/trips/{trip_id}/dispatch`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `dispatch_trip_endpoint()`  
**Service:** `trip_service.dispatch_trip()`  
**No request body required**

**Business Rules Enforced (in order):**
1. Trip must be in `draft` status
2. Vehicle must be `available` (BR-02)
3. Driver must be `available` (BR-03)
4. Driver `license_expiry` must be ≥ today (BR-04)

**Side Effects (atomic):**
- `trip.status → dispatched`
- `trip.dispatched_at → now(UTC)`
- `vehicle.status → on_trip`
- `driver.status → on_trip`

**Response `200`:** `TripResponse` with `status: "dispatched"`

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Trip must be in draft status to dispatch (current status: ...)"` | BR-02 pre-check |
| 400 | `"Vehicle ... is not available for dispatch (current status: ...)"` | BR-02 |
| 400 | `"Driver ... cannot be assigned (current status: ...)"` | BR-03 |
| 400 | `"Driver ... license expired on ..."` | BR-04 |
| 404 | Trip/vehicle/driver not found |

---

### `POST /api/v1/trips/{trip_id}/complete`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `complete_trip_endpoint()`  
**Service:** `trip_service.complete_trip()`  
**⚠️ Trip must be in `dispatched` status**

**Request Body:**
```json
{
  "actual_distance_km": 33.5,
  "final_odometer_km": 12373.5
}
```

**Side Effects (atomic):**
- `trip.status → completed`
- `trip.completed_at → now(UTC)`
- `trip.actual_distance_km → actual_distance_km`
- `vehicle.odometer_km → final_odometer_km`
- `vehicle.status → available`
- `driver.status → available`

**Response `200`:** `TripResponse` with `status: "completed"`

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Trip must be dispatched to complete (current status: ...)"` | Wrong status |
| 404 | Trip/vehicle/driver not found |

---

### `POST /api/v1/trips/{trip_id}/cancel`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `cancel_trip_endpoint()`  
**Service:** `trip_service.cancel_trip()`  
**⚠️ Trip must be in `dispatched` status**

**Request Body:**
```json
{
  "reason": "Customer cancelled order"
}
```

**Side Effects (atomic):**
- `trip.status → cancelled`
- `trip.cancelled_at → now(UTC)`
- Cancellation reason appended to `trip.notes`
- `vehicle.status → available`
- `driver.status → available`

**Response `200`:** `TripResponse` with `status: "cancelled"`

**Errors:**
| Status | Detail | Cause |
|---|---|---|
| 400 | `"Trip must be dispatched to cancel (current status: ...)"` | Wrong status |
| 404 | Trip/vehicle/driver not found |

---

### `POST /api/v1/trips/suggest`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/trips.py` → `suggest_trip_dispatch()`  
**Service:** `trip_service.get_eligible_candidates()` + `llm_service.call_llm()`  
**Purpose:** AI Dispatch Advisor — ranks eligible vehicle+driver pairs

**Request Body:**
```json
{
  "source": "Gandhinagar Depot",
  "destination": "Ahmedabad Hub",
  "cargo_weight_kg": 450.0,
  "planned_distance_km": 35.0
}
```

**How it works:**
1. `get_eligible_candidates()` filters: `vehicle.status = available` AND `vehicle.max_load_kg >= cargo_weight_kg` AND `driver.status = available` AND `driver.license_expiry >= today`
2. Sends top 10 candidates to Azure OpenAI (GPT-4o-mini) for natural-language ranking
3. Falls back to sort-by-safety-score if LLM fails

**Response `200`:**
```json
{
  "suggestions": [
    {
      "rank": 1,
      "vehicle_id": "uuid",
      "vehicle_name": "Van-05",
      "driver_id": "uuid",
      "driver_name": "Alex Fernandes",
      "reason": "Capacity fits with 50 kg margin, 96% safety score, no active trips."
    }
  ],
  "excluded": "Truck-11 (GJ-02-BB-0012) excluded — status is on_trip. Raj Patel excluded — license expired on 2025-03-15."
}
```

---

## Maintenance

### `GET /api/v1/maintenance/`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/maintenance.py` → `list_maintenance()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `status` | MaintenanceStatus | Filter by status (`open`\|`closed`) |
| `vehicle_id` | UUID | Filter by vehicle |
| `sort_by` | string | Column to sort (default: `created_at`) |
| `sort_order` | `asc`\|`desc` | Sort direction |
| `page`, `page_size` | int | Pagination |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "type": "Oil Change",
      "description": "Scheduled 10k km service",
      "cost": 3500.0,
      "odometer_at_service": 12340.0,
      "status": "open",
      "scheduled_date": "2026-07-12",
      "completed_date": null,
      "created_by": "uuid",
      "created_at": "2026-07-12T08:00:00Z",
      "updated_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

---

### `GET /api/v1/maintenance/{log_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/maintenance.py` → `get_maintenance()`

---

### `POST /api/v1/maintenance/`
**Auth:** Required  
**Roles:** `fleet_manager`, `safety_officer`  
**File:** `app/api/v1/maintenance.py` → `create_maintenance_record()`  
**Service:** `maintenance_service.create_maintenance()`

**Business Rule (BR-09):** Creating a record automatically sets `vehicle.status → in_shop`

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "type": "Oil Change",
  "description": "Scheduled 10k km service",
  "cost": 3500.0,
  "odometer_at_service": 12340.0,
  "scheduled_date": "2026-07-12"
}
```

> `description`, `odometer_at_service`, `scheduled_date` are optional.

**Response `201`:** `MaintenanceResponse`

**Side Effects:** `vehicle.status → in_shop`

**Errors:**
| Status | Detail |
|---|---|
| 404 | `"Vehicle not found"` |

---

### `PATCH /api/v1/maintenance/{log_id}`
**Auth:** Required  
**Roles:** `fleet_manager`, `safety_officer`  
**File:** `app/api/v1/maintenance.py` → `update_maintenance()`  
**⚠️ Cannot update a closed record**

**Request Body:** Any subset:
```json
{
  "cost": 4200.0,
  "description": "Updated: also replaced air filter"
}
```

**Errors:**
| Status | Detail |
|---|---|
| 400 | `"Cannot update a closed maintenance record"` |
| 404 | `"Maintenance record not found"` |

---

### `POST /api/v1/maintenance/{log_id}/close`
**Auth:** Required  
**Roles:** `fleet_manager`, `safety_officer`  
**File:** `app/api/v1/maintenance.py` → `close_maintenance_record()`  
**Service:** `maintenance_service.close_maintenance()`

**Business Rule (BR-10):** Closing restores `vehicle.status → available` unless vehicle is `retired`

**Request Body:**
```json
{
  "completed_date": "2026-07-13",
  "final_cost": 3800.0
}
```

> `final_cost` is optional — if provided, overwrites the original cost.

**Response `200`:** `MaintenanceResponse` with `status: "closed"`

**Side Effects:** `vehicle.status → available` (unless vehicle is `retired`)

**Errors:**
| Status | Detail |
|---|---|
| 400 | `"Maintenance record is already closed"` |
| 404 | `"Maintenance record not found"` or `"Associated vehicle not found"` |

---

## Fuel Logs

### `GET /api/v1/fuel-logs/`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`, `financial_analyst`  
**File:** `app/api/v1/fuel_logs.py` → `list_fuel_logs()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `vehicle_id` | UUID | Filter by vehicle |
| `trip_id` | UUID | Filter by trip |
| `page`, `page_size` | int | Pagination |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "trip_id": "uuid-or-null",
      "liters": 45.5,
      "cost_per_liter": 106.72,
      "total_cost": 4855.76,
      "odometer_at_fill": 12380.0,
      "filled_at": "2026-07-12",
      "created_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 8,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

> `total_cost` is a **PostgreSQL generated column** (`liters * cost_per_liter`) — never sent by client.

---

### `GET /api/v1/fuel-logs/{log_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/fuel_logs.py` → `get_fuel_log()`

---

### `POST /api/v1/fuel-logs/`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/fuel_logs.py` → `create_fuel_log()`

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "trip_id": "uuid-or-null",
  "liters": 45.5,
  "cost_per_liter": 106.72,
  "odometer_at_fill": 12380.0,
  "filled_at": "2026-07-12"
}
```

> Do **NOT** send `total_cost` — it is DB-computed.

**Response `201`:** `FuelLogResponse`

---

### `DELETE /api/v1/fuel-logs/{log_id}`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/fuel_logs.py` → `delete_fuel_log()`  
**⚠️ Hard delete — permanent**

**Response `204`:** No content

---

## Expenses

### `GET /api/v1/expenses/`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`, `financial_analyst`  
**File:** `app/api/v1/expenses.py` → `list_expenses()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `vehicle_id` | UUID | Filter by vehicle |
| `trip_id` | UUID | Filter by trip |
| `category` | ExpenseCategory | Filter by category |
| `page`, `page_size` | int | Pagination |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "vehicle_id": "uuid",
      "trip_id": "uuid-or-null",
      "category": "toll",
      "amount": 250.0,
      "description": "NH-8 toll gate",
      "expense_date": "2026-07-12",
      "created_by": "uuid",
      "created_at": "2026-07-12T08:00:00Z"
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 20,
  "pages": 1
}
```

---

### `GET /api/v1/expenses/{expense_id}`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/expenses.py` → `get_expense()`

---

### `POST /api/v1/expenses/`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/expenses.py` → `create_expense()`

**Request Body:**
```json
{
  "vehicle_id": "uuid",
  "trip_id": "uuid-or-null",
  "category": "toll",
  "amount": 250.0,
  "description": "NH-8 toll gate",
  "expense_date": "2026-07-12"
}
```

**Response `201`:** `ExpenseResponse`

---

### `DELETE /api/v1/expenses/{expense_id}`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/expenses.py` → `delete_expense()`  
**⚠️ Hard delete — permanent**

**Response `204`:** No content

---

## Dashboard

### `GET /api/v1/dashboard`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/dashboard.py` → `get_dashboard_metrics()`  
**DB:** Raw SQL queries (not ORM) with FILTER aggregation

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `vehicle_type` | string | Filter KPIs by vehicle type |
| `region` | string | ILIKE filter KPIs by region |

**Response `200`:**
```json
{
  "total_vehicles": 24,
  "available_vehicles": 12,
  "vehicles_on_trip": 8,
  "vehicles_in_shop": 3,
  "vehicles_retired": 1,
  "fleet_utilization_pct": 34.8,
  "active_trips": 8,
  "pending_trips": 4,
  "drivers_on_duty": 8,
  "drivers_available": 15
}
```

> `fleet_utilization_pct = vehicles_on_trip / (total_vehicles - vehicles_retired) * 100`

---

### `GET /api/v1/dashboard/active-trips`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/dashboard.py` → `get_active_trips()`

Returns all trips with `status = "dispatched"`, ordered by `created_at DESC`.

**Response `200`:** `list[TripResponse]`

---

### `POST /api/v1/dashboard/briefing`
**Auth:** Required (no role guard — any role)  
**File:** `app/api/v1/dashboard.py` → `get_briefing()`  
**Service:** `llm_service.call_llm()` with Azure OpenAI  
**No request body required**

**How it works:**
1. Checks `briefing_cache` table for non-expired entry (`expires_at > now()`)
2. If cached: returns immediately
3. If not cached: gathers `vw_fleet_kpis` + recent trips + expiring licenses → calls LLM
4. Caches result for **5 minutes**
5. If LLM fails: returns most recent stale cache, or hardcoded fallback

**Response `200`:**
```json
{
  "content": "Fleet utilization is at 81%. Driver John's license expired 3/25/2025 and he is blocked from dispatch. Truck-11 has generated ₹28,750 in maintenance+fuel this month — the highest in the fleet. No critical maintenance overdue at this time.",
  "generated_at": "2026-07-12T08:00:00Z",
  "cached": true
}
```

---

## Reports

### `GET /api/v1/reports/fuel-efficiency`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/reports.py` → `fuel_efficiency_endpoint()`  
**Service:** `report_service.get_fuel_efficiency()`  
**DB:** Reads from view `vw_trip_fuel_efficiency`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `vehicle_id` | UUID | Filter by vehicle (optional) |

**Response `200`:**
```json
[
  {
    "trip_id": "uuid",
    "vehicle_id": "uuid",
    "registration_number": "GJ-01-AA-0001",
    "actual_distance_km": 33.5,
    "total_liters": 4.2,
    "km_per_liter": 7.98
  }
]
```

---

### `GET /api/v1/reports/fleet-utilization`
**Auth:** Required  
**Roles:** `fleet_manager`, `financial_analyst`  
**File:** `app/api/v1/reports.py` → `fleet_utilization_endpoint()`  
**Service:** `report_service.get_fleet_utilization()`

**Query Params:**
| Param | Type | Description |
|---|---|---|
| `start_date` | date (YYYY-MM-DD) | Start of range (defaults to 30 days ago) |
| `end_date` | date (YYYY-MM-DD) | End of range (defaults to today) |

**Response `200`:**
```json
[
  {
    "date": "2026-07-01",
    "vehicles_on_trip": 5,
    "total_active_vehicles": 23,
    "utilization_pct": 21.7
  },
  {
    "date": "2026-07-02",
    "vehicles_on_trip": 8,
    "total_active_vehicles": 23,
    "utilization_pct": 34.8
  }
]
```

**Errors:**
| Status | Detail |
|---|---|
| 400 | `"start_date must be on or before end_date"` |

---

### `GET /api/v1/reports/operational-cost`
**Auth:** Required  
**Roles:** `fleet_manager`, `financial_analyst`  
**File:** `app/api/v1/reports.py` → `operational_cost_endpoint()`  
**Service:** `report_service.get_operational_cost()`  
**DB:** Reads from view `vw_vehicle_cost_summary`

**Response `200`:**
```json
[
  {
    "vehicle_id": "uuid",
    "registration_number": "GJ-01-AA-0001",
    "name": "Van-05",
    "total_fuel_cost": 45200.0,
    "total_maintenance_cost": 12300.0,
    "total_operational_cost": 57500.0
  }
]
```

---

### `GET /api/v1/reports/vehicle-roi`
**Auth:** Required  
**Roles:** `fleet_manager`, `financial_analyst`  
**File:** `app/api/v1/reports.py` → `vehicle_roi_endpoint()`  
**Service:** `report_service.get_vehicle_roi()`  
**DB:** Reads from view `vw_vehicle_cost_summary`  
**Formula:** `roi = (revenue - (fuel + maintenance)) / acquisition_cost`

**Response `200`:**
```json
[
  {
    "vehicle_id": "uuid",
    "registration_number": "GJ-01-AA-0001",
    "name": "Van-05",
    "acquisition_cost": 850000.0,
    "total_fuel_cost": 45200.0,
    "total_maintenance_cost": 12300.0,
    "total_operational_cost": 57500.0,
    "total_revenue": 210000.0,
    "roi": 0.1794
  }
]
```

> `roi` is `null` when `acquisition_cost = 0`

---

### `GET /api/v1/reports/export/csv`
**Auth:** Required  
**Roles:** `fleet_manager`, `financial_analyst`  
**File:** `app/api/v1/reports.py` → `export_csv_endpoint()`  
**Returns:** `text/csv` file download

**Query Params:**
| Param | Required | Values |
|---|---|---|
| `report` | ✅ | `vehicle-roi` \| `fuel-efficiency` \| `operational-cost` \| `fleet-utilization` |

**Response:** CSV file with `Content-Disposition: attachment; filename=<report_name>.csv`

**Errors:**
| Status | Detail |
|---|---|
| 400 | `"Unknown report '...'. Must be one of: ..."` |

---

## Fleet Map

### `GET /api/v1/fleet/locations`
**Auth:** Required  
**Roles:** Any  
**File:** `app/api/v1/fleet.py` → `get_fleet_locations()`  
**Purpose:** Powers the live fleet map — returns all non-retired vehicles with lat/lng

**Response `200`:**
```json
[
  {
    "vehicle_id": "uuid",
    "registration_number": "GJ-01-AA-0001",
    "name": "Van-05",
    "status": "available",
    "lat": 23.2156,
    "lng": 72.6369
  }
]
```

> `lat` and `lng` are `null` if not set on the vehicle record

---

## Control Tower

### `POST /api/v1/trips/autopilot/toggle`
**Auth:** Required  
**Roles:** `fleet_manager`  
**File:** `app/api/v1/autopilot.py` → `toggle_autopilot()`  
**State:** In-memory (resets on server restart — hackathon scope)

**Request Body:**
```json
{ "enabled": true }
```

**Response `200`:**
```json
{
  "enabled": true,
  "message": "Autopilot enabled"
}
```

---

### `GET /api/v1/trips/autopilot/feed`
**Auth:** Required  
**Roles:** `fleet_manager`, `dispatcher`  
**File:** `app/api/v1/autopilot.py` → `get_autopilot_feed()`  
**Service:** `trip_service.get_eligible_candidates()` + `llm_service.call_llm()`

**How it works (when autopilot is enabled):**
1. Fetches all `draft` trips
2. For each: runs `get_eligible_candidates()` with the trip's cargo weight
3. If 1 candidate → auto-dispatch (no LLM needed, high confidence)
4. If multiple candidates → asks LLM (Azure GPT-4o-mini) to decide dispatch/escalate
5. If 0 candidates → escalate to pending
6. Commits all changes atomically

**Response `200`:**
```json
{
  "events": [
    {
      "id": "uuid",
      "timestamp": "2026-07-12T08:00:00Z",
      "event_type": "auto_dispatched",
      "trip_id": "uuid",
      "vehicle_id": "uuid",
      "vehicle_name": "Van-05",
      "driver_id": "uuid",
      "driver_name": "Alex Fernandes",
      "reason": "Single unambiguous candidate: Van-05 + Alex Fernandes. Capacity 500.0kg fits 450.0kg cargo.",
      "status": "dispatched"
    },
    {
      "id": "uuid",
      "timestamp": "2026-07-12T08:01:00Z",
      "event_type": "escalated",
      "trip_id": "uuid",
      "vehicle_id": null,
      "vehicle_name": null,
      "driver_id": null,
      "driver_name": null,
      "reason": "No eligible vehicles/drivers found for this trip.",
      "status": "pending"
    }
  ],
  "autopilot_enabled": true,
  "total_dispatched": 1,
  "total_escalated": 1
}
```

---

## Chat

### `POST /api/v1/chat/ask`
**Auth:** Not required (no auth guard in implementation)  
**File:** `app/api/v1/chat.py` → `ask_transitops()`  
**Service:** `llm_service.call_llm()` with Azure OpenAI

**How it works:**
1. Gathers full context: all vehicles, all drivers, recent 10 trips, recent 10 expenses, `vw_fleet_kpis`
2. Passes user question + context to GPT-4o-mini
3. Falls back to hardcoded message if LLM fails

**Request Body:**
```json
{
  "question": "Which drivers have licences expiring this month?"
}
```

**Response `200`:**
```json
{
  "answer": "Two drivers have licences expiring in July 2026: Alex Fernandes (Jul 15) and Raj Patel (Jul 28). Please ensure their licences are renewed before the expiry date to avoid dispatch blocks."
}
```

---

## Full API → Function Call Trace

| HTTP | Path | Router Function | Service/DB |
|---|---|---|---|
| GET | /health | `main.health()` | — |
| POST | /auth/login | `auth.login()` | `security.verify_password()`, `security.create_access_token()` |
| GET | /auth/me | `auth.get_me()` | `deps.get_current_user()` |
| POST | /auth/users | `auth.create_user()` | `security.hash_password()` |
| GET | /vehicles/ | `vehicles.list_vehicles()` | Direct ORM query |
| GET | /vehicles/available | `vehicles.list_available_vehicles()` | Direct ORM query |
| GET | /vehicles/{id} | `vehicles.get_vehicle()` | `db.get(Vehicle, id)` |
| GET | /vehicles/{id}/cost-summary | `vehicles.get_vehicle_cost_summary()` | SQL: `vw_vehicle_cost_summary` |
| POST | /vehicles/ | `vehicles.create_vehicle()` | `db.add(Vehicle)` |
| PATCH | /vehicles/{id} | `vehicles.update_vehicle()` | `db.get(Vehicle)` + setattr |
| DELETE | /vehicles/{id} | `vehicles.delete_vehicle()` | Sets `status=retired` |
| GET | /drivers/ | `drivers.list_drivers()` | Direct ORM query |
| GET | /drivers/available | `drivers.list_available_drivers()` | ORM: status=available, expiry>=today |
| GET | /drivers/expiring-licenses | `drivers.list_expiring_licenses()` | ORM: expiry BETWEEN today AND today+30d |
| GET | /drivers/{id} | `drivers.get_driver()` | `db.get(Driver, id)` |
| POST | /drivers/ | `drivers.create_driver()` | `db.add(Driver)` |
| PATCH | /drivers/{id} | `drivers.update_driver()` | `db.get(Driver)` + setattr |
| DELETE | /drivers/{id} | `drivers.delete_driver()` | Sets `status=suspended` |
| GET | /trips | `trips.list_trips_endpoint()` | `trip_service.list_trips()` |
| POST | /trips | `trips.create_trip_endpoint()` | `trip_service.create_trip()` |
| GET | /trips/{id} | `trips.get_trip_endpoint()` | `trip_service.get_trip()` → `_get_trip_or_404()` |
| PATCH | /trips/{id} | `trips.update_trip_endpoint()` | `trip_service.update_trip_draft()` |
| POST | /trips/{id}/dispatch | `trips.dispatch_trip_endpoint()` | `trip_service.dispatch_trip()` |
| POST | /trips/{id}/complete | `trips.complete_trip_endpoint()` | `trip_service.complete_trip()` |
| POST | /trips/{id}/cancel | `trips.cancel_trip_endpoint()` | `trip_service.cancel_trip()` |
| POST | /trips/suggest | `trips.suggest_trip_dispatch()` | `trip_service.get_eligible_candidates()` + `llm_service.call_llm()` |
| GET | /maintenance/ | `maintenance.list_maintenance()` | Direct ORM query |
| GET | /maintenance/{id} | `maintenance.get_maintenance()` | `db.get(MaintenanceLog, id)` |
| POST | /maintenance/ | `maintenance.create_maintenance_record()` | `maintenance_service.create_maintenance()` |
| PATCH | /maintenance/{id} | `maintenance.update_maintenance()` | `db.get(MaintenanceLog)` + setattr |
| POST | /maintenance/{id}/close | `maintenance.close_maintenance_record()` | `maintenance_service.close_maintenance()` |
| GET | /fuel-logs/ | `fuel_logs.list_fuel_logs()` | Direct ORM query |
| GET | /fuel-logs/{id} | `fuel_logs.get_fuel_log()` | `db.get(FuelLog, id)` |
| POST | /fuel-logs/ | `fuel_logs.create_fuel_log()` | `db.add(FuelLog)` |
| DELETE | /fuel-logs/{id} | `fuel_logs.delete_fuel_log()` | `db.delete(FuelLog)` |
| GET | /expenses/ | `expenses.list_expenses()` | Direct ORM query |
| GET | /expenses/{id} | `expenses.get_expense()` | `db.get(Expense, id)` |
| POST | /expenses/ | `expenses.create_expense()` | `db.add(Expense)` |
| DELETE | /expenses/{id} | `expenses.delete_expense()` | `db.delete(Expense)` |
| GET | /dashboard | `dashboard.get_dashboard_metrics()` | Raw SQL (vehicles + trips + drivers) |
| GET | /dashboard/active-trips | `dashboard.get_active_trips()` | ORM: Trip.status=dispatched |
| POST | /dashboard/briefing | `dashboard.get_briefing()` | `BriefingCache` check → `vw_fleet_kpis` → `llm_service.call_llm()` |
| GET | /reports/fuel-efficiency | `reports.fuel_efficiency_endpoint()` | `report_service.get_fuel_efficiency()` → SQL: `vw_trip_fuel_efficiency` |
| GET | /reports/fleet-utilization | `reports.fleet_utilization_endpoint()` | `report_service.get_fleet_utilization()` → daily loop SQL |
| GET | /reports/operational-cost | `reports.operational_cost_endpoint()` | `report_service.get_operational_cost()` → SQL: `vw_vehicle_cost_summary` |
| GET | /reports/vehicle-roi | `reports.vehicle_roi_endpoint()` | `report_service.get_vehicle_roi()` → SQL: `vw_vehicle_cost_summary` |
| GET | /reports/export/csv | `reports.export_csv_endpoint()` | Same service functions → `csv.DictWriter` → `StreamingResponse` |
| GET | /fleet/locations | `fleet.get_fleet_locations()` | ORM: Vehicle where status != retired |
| POST | /trips/autopilot/toggle | `autopilot.toggle_autopilot()` | In-memory `_autopilot_enabled` flag |
| GET | /trips/autopilot/feed | `autopilot.get_autopilot_feed()` | `trip_service.get_eligible_candidates()` + `llm_service.call_llm()` (if enabled) |
| POST | /chat/ask | `chat.ask_transitops()` | `_gather_context()` (full table scan) + `llm_service.call_llm()` |

---

## RBAC Quick Reference

| Role | Vehicles | Drivers | Trips | Maintenance | Fuel/Expenses | Reports | Dashboard | Autopilot |
|---|---|---|---|---|---|---|---|---|
| `fleet_manager` | Full CRUD | Full CRUD | Create + Lifecycle | Full CRUD | Create + Delete | Full | Full | Toggle |
| `dispatcher` | Read | Read | Create + Lifecycle | ❌ | Create | ❌ | Full | Feed only |
| `safety_officer` | Read | Full CRUD | Read | Full CRUD | ❌ | ❌ | Full | ❌ |
| `financial_analyst` | Read (no cost-summary) | Read | Read | Read | Read | Full | Full | ❌ |

> **Note:** `fleet_manager` gets `cost-summary` and all financial reports. `financial_analyst` gets reports but NOT vehicle cost-summary via the vehicles endpoint.

---

## Frontend Integration Notes

### 1. Token Storage & Refresh
Store token in `httpOnly` cookie or `localStorage`. Token TTL = **120 minutes** — build an interceptor that re-authenticates on 401.

### 2. Dropdown Preloading
- Vehicle dropdown: `GET /vehicles/available`
- Driver dropdown: `GET /drivers/available`
Both return only eligible records — no client-side filtering needed.

### 3. Trip Lifecycle UI State Machine
```
Draft → [Dispatch button] → Dispatched → [Complete button] / [Cancel button] → Completed / Cancelled
```
Only show action buttons for the current status.

### 4. Dashboard Polling
`GET /dashboard` and `GET /dashboard/active-trips` can be polled every 15–30 seconds for live KPIs. `POST /dashboard/briefing` is cached for 5 min — call on page load, not on every poll.

### 5. Fleet Map Data
`GET /fleet/locations` — update markers every 15 seconds. Vehicles with `lat=null`/`lng=null` can be shown at the depot origin or hidden.

### 6. AI Features
- **Dispatch Advisor:** Call `POST /trips/suggest` when source/destination/cargo are filled. Show loading spinner — LLM may take 2–4s.
- **Daily Briefing:** Call `POST /dashboard/briefing` once on dashboard load. `cached: true` means instant response.
- **Chat:** `POST /chat/ask` — no auth guard in current implementation, but add auth header anyway.

### 7. CSV Download
```js
const res = await fetch('/api/v1/reports/export/csv?report=vehicle-roi', { headers: { Authorization: 'Bearer ...' } });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'vehicle_roi.csv'; a.click();
```

### 8. Error Handling
All business rule errors return `{ "detail": "..." }`. Pydantic validation errors return `{ "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }`.

---

## Environment Variables Required

```env
DATABASE_URL=postgresql+asyncpg://transit:secret@localhost:5432/transitops
jwt_secret_key=your-super-secret-key-here
jwt_algorithm=HS256
jwt_expire_minutes=120
default_admin_email=admin@transitops.com
default_admin_password=admin123

# Azure OpenAI (required for AI features)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

> If Azure credentials are missing/invalid, all AI endpoints fall back gracefully — no crash.
