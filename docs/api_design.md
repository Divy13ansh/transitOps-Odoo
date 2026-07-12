# TransitOps — API Design

**Base URL:** `/api/v1`  
**Auth:** Bearer JWT (all endpoints except `/auth/login`)  
**Content-Type:** `application/json`

---

## Auth

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Email + password → JWT token |
| `GET` | `/auth/me` | Any | Current user profile |
| `POST` | `/auth/users` | fleet_manager | Create a new user with role |

### POST `/auth/login`
**Request:**
```json
{ "email": "admin@transitops.com", "password": "secret" }
```
**Response:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

---

## Dashboard

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/dashboard` | All | Aggregated KPIs |
| `GET` | `/dashboard/active-trips` | All | Live trip feed |

### GET `/dashboard`
Query params: `?vehicle_type=Van&region=North`

**Response:**
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

---

## Vehicles

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/vehicles` | All | List vehicles (filter/sort/paginate) |
| `POST` | `/vehicles` | fleet_manager | Register a vehicle |
| `GET` | `/vehicles/{id}` | All | Vehicle detail |
| `PATCH` | `/vehicles/{id}` | fleet_manager | Update vehicle fields |
| `DELETE` | `/vehicles/{id}` | fleet_manager | Soft-delete (retire) |
| `GET` | `/vehicles/{id}/cost-summary` | fleet_manager, financial_analyst | Cost + ROI |
| `GET` | `/vehicles/available` | dispatcher, fleet_manager | Vehicles eligible for dispatch |

### POST `/vehicles`
```json
{
  "registration_number": "MH-01-AB-1234",
  "name": "Tata Ace Van-05",
  "type": "Van",
  "max_load_kg": 500.0,
  "odometer_km": 12340.0,
  "acquisition_cost": 850000.0,
  "region": "Mumbai North"
}
```

### GET `/vehicles` — Query Params
| Param | Type | Example |
|---|---|---|
| `status` | enum | `available` |
| `type` | string | `Van` |
| `region` | string | `North` |
| `search` | string | `MH-01` |
| `page` | int | `1` |
| `page_size` | int | `20` |
| `sort_by` | string | `registration_number` |
| `sort_order` | `asc`/`desc` | `asc` |

---

## Drivers

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/drivers` | All | List drivers |
| `POST` | `/drivers` | fleet_manager, safety_officer | Register driver |
| `GET` | `/drivers/{id}` | All | Driver detail |
| `PATCH` | `/drivers/{id}` | fleet_manager, safety_officer | Update driver |
| `DELETE` | `/drivers/{id}` | fleet_manager | Suspend driver |
| `GET` | `/drivers/available` | dispatcher, fleet_manager | Drivers eligible for dispatch |
| `GET` | `/drivers/expiring-licenses` | safety_officer, fleet_manager | Licenses expiring in 30 days |

### POST `/drivers`
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

---

## Trips

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/trips` | All | List trips (filter by status, vehicle, driver) |
| `POST` | `/trips` | fleet_manager, dispatcher | Create trip (Draft) |
| `GET` | `/trips/{id}` | All | Trip detail |
| `PATCH` | `/trips/{id}` | fleet_manager, dispatcher | Update draft trip |
| `POST` | `/trips/{id}/dispatch` | fleet_manager, dispatcher | Draft → Dispatched |
| `POST` | `/trips/{id}/complete` | fleet_manager, dispatcher | Dispatched → Completed |
| `POST` | `/trips/{id}/cancel` | fleet_manager, dispatcher | Dispatched → Cancelled |

### POST `/trips`
```json
{
  "vehicle_id": "uuid",
  "driver_id": "uuid",
  "source": "Mumbai Warehouse",
  "destination": "Pune Distribution Center",
  "planned_distance_km": 160.0,
  "cargo_weight_kg": 450.0,
  "revenue": 12000.0,
  "notes": "Fragile goods"
}
```

**Validations on create:**
1. Vehicle must have status `available`
2. Driver must have status `available`
3. Driver license must not be expired
4. Driver must not be `suspended`
5. `cargo_weight_kg ≤ vehicle.max_load_kg`

### POST `/trips/{id}/dispatch`
No body. Side effects:
- `trip.status → dispatched`
- `trip.dispatched_at → now()`
- `vehicle.status → on_trip`
- `driver.status → on_trip`

### POST `/trips/{id}/complete`
```json
{
  "actual_distance_km": 158.5,
  "final_odometer_km": 12498.5
}
```
Side effects:
- `trip.status → completed`, `trip.completed_at → now()`
- `vehicle.odometer_km → final_odometer_km`
- `vehicle.status → available`
- `driver.status → available`

### POST `/trips/{id}/cancel`
```json
{ "reason": "Customer cancelled" }
```
Side effects:
- `trip.status → cancelled`, `trip.cancelled_at → now()`
- `vehicle.status → available`
- `driver.status → available`

---

## Maintenance

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/maintenance` | All | List maintenance records |
| `POST` | `/maintenance` | fleet_manager, safety_officer | Create record (opens In Shop) |
| `GET` | `/maintenance/{id}` | All | Record detail |
| `PATCH` | `/maintenance/{id}` | fleet_manager, safety_officer | Update open record |
| `POST` | `/maintenance/{id}/close` | fleet_manager, safety_officer | Close → vehicle Available |

### POST `/maintenance`
```json
{
  "vehicle_id": "uuid",
  "type": "Oil Change",
  "description": "Scheduled 10k km service",
  "cost": 3500.00,
  "odometer_at_service": 12340.0,
  "scheduled_date": "2026-07-12"
}
```
Side effects: `vehicle.status → in_shop`

### POST `/maintenance/{id}/close`
```json
{ "completed_date": "2026-07-13", "final_cost": 3800.00 }
```
Side effects: `vehicle.status → available` (unless retired)

---

## Fuel Logs

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/fuel-logs` | fleet_manager, dispatcher, financial_analyst | List (filter by vehicle, trip, date) |
| `POST` | `/fuel-logs` | fleet_manager, dispatcher | Log a fill-up |
| `GET` | `/fuel-logs/{id}` | All | Record detail |
| `DELETE` | `/fuel-logs/{id}` | fleet_manager | Delete (correction) |

### POST `/fuel-logs`
```json
{
  "vehicle_id": "uuid",
  "trip_id": "uuid",
  "liters": 45.5,
  "cost_per_liter": 106.72,
  "odometer_at_fill": 12380.0,
  "filled_at": "2026-07-12"
}
```
`total_cost` is computed as a generated column — never sent by client.

---

## Expenses

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/expenses` | fleet_manager, financial_analyst | List expenses |
| `POST` | `/expenses` | fleet_manager, dispatcher | Record expense |
| `GET` | `/expenses/{id}` | All | Expense detail |
| `DELETE` | `/expenses/{id}` | fleet_manager | Delete (correction) |

### POST `/expenses`
```json
{
  "vehicle_id": "uuid",
  "trip_id": "uuid",
  "category": "toll",
  "amount": 250.00,
  "description": "NH-8 toll gate",
  "expense_date": "2026-07-12"
}
```

---

## Reports & Analytics

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/reports/fuel-efficiency` | All | km/liter by vehicle or trip |
| `GET` | `/reports/fleet-utilization` | fleet_manager, financial_analyst | Utilization over time |
| `GET` | `/reports/operational-cost` | fleet_manager, financial_analyst | Cost breakdown |
| `GET` | `/reports/vehicle-roi` | fleet_manager, financial_analyst | ROI per vehicle |
| `GET` | `/reports/export/csv` | fleet_manager, financial_analyst | CSV download |
| `GET` | `/reports/export/pdf` | fleet_manager, financial_analyst | PDF download |

### GET `/reports/vehicle-roi`
**Response:**
```json
[
  {
    "vehicle_id": "uuid",
    "registration_number": "MH-01-AB-1234",
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

### GET `/reports/export/csv?report=vehicle-roi`
Returns `Content-Type: text/csv` with `Content-Disposition: attachment; filename=vehicle_roi.csv`

---

## Common Response Patterns

### Paginated List
```json
{
  "items": [...],
  "total": 48,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

### Error Response
```json
{
  "detail": "cargo_weight_kg (520 kg) exceeds vehicle max load capacity (500 kg)"
}
```

### HTTP Status Codes
| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request / Business rule violation |
| `401` | Unauthenticated |
| `403` | Insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate registration number) |
| `422` | Validation error (Pydantic) |
