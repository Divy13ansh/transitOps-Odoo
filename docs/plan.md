# TransitOps — Build Plan
**Hackathon:** Odoo Hackathon — Smart Transport Operations Platform
**Duration:** 6–7 hours
**Team:** 2 Backend, 1 Frontend

---

## 1. Strategy

The base problem statement (auth, vehicle/driver registry, trip dispatch, maintenance, fuel/expense, reports) will be built by most teams. Our differentiation comes from three additive layers, built **on top of** — not instead of — the mandatory spec:

1. A live fleet **map** (visual differentiation, first impression)
2. **GenAI features** that wrap data we're already computing (no new ML models, no training, just LLM calls over structured data)
3. An **autonomous dispatch agent** ("Control Tower" mode) — our moonshot, but explicitly **lowest priority**, built only if core + GenAI features are complete with time remaining

Guiding rule: every AI feature must reuse business logic and data we are already building for the mandatory spec. No feature should require new backend concepts that aren't already needed for TransitOps core.

---

## 2. Priority Order (build in this sequence)

| Priority | Feature | Status |
|---|---|---|
| P0 | Auth + RBAC | Mandatory |
| P0 | Vehicle Registry (CRUD) | Mandatory |
| P0 | Driver Management (CRUD) | Mandatory |
| P0 | Trip Management + lifecycle + validation rules | Mandatory |
| P0 | Maintenance workflow (auto status transitions) | Mandatory |
| P0 | Fuel & Expense logging + cost calc | Mandatory |
| P0 | Dashboard with KPIs | Mandatory |
| P0 | Reports & Analytics (fuel efficiency, utilization, ROI) | Mandatory |
| P1 | Live Fleet Map (static/animated markers on Dashboard + Trip Dispatcher) | Differentiator |
| P1 | AI Dispatch Advisor (ranked driver/vehicle suggestions) | Differentiator |
| P1 | AI Daily Ops Briefing (dashboard summary card) | Differentiator |
| P2 | "Ask TransitOps" chat widget (Q&A over fleet data) | Stretch — build only if P0+P1 done early |
| P3 | **Control Tower — Autonomous Dispatch Agent** | Moonshot — **lowest priority**, build only if everything above is done and stable, with time left on the clock |

**Rule:** Do not start P2 or P3 until every P0 and P1 item is functional and demo-ready. A polished P1 build beats a half-working P3 build in every judging scenario.

---

## 3. Core Mandatory Features (P0)

Reference: original TransitOps problem statement + shared Excalidraw mockup (8 screens: Auth, Dashboard, Vehicle Registry, Drivers & Safety Profiles, Trip Dispatcher, Maintenance, Fuel & Expense, Reports & Analytics, Settings & RBAC).

### 3.1 Authentication
- Email/password login, RBAC with 4 roles: Fleet Manager, Dispatcher, Safety Officer, Financial Analyst
- Role-scoped navigation per mockup (Screen 0):
  - Fleet Manager → Fleet, Maintenance
  - Dispatcher → Dashboard, Trips
  - Safety Officer → Drivers, Compliance
  - Financial Analyst → Fuel & Expenses, Analytics

### 3.2 Dashboard
- KPIs: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips, Pending Trips, Drivers On Duty, Fleet Utilization %
- Filters: vehicle type, status, region
- Recent Trips table + Vehicle Status breakdown

### 3.3 Vehicle Registry
- Fields: Registration Number (unique), Name/Model, Type, Max Load Capacity, Odometer, Acquisition Cost, Status
- Status: Available, On Trip, In Shop, Retired
- Rule: Retired/In Shop vehicles excluded from dispatch pool

### 3.4 Driver Management
- Fields: Name, License Number, License Category, License Expiry, Contact, Safety Score, Status
- Status: Available, On Trip, Off Duty, Suspended
- Rule: Expired license or Suspended → blocked from trip assignment

### 3.5 Trip Management
- Create trip: source, destination, vehicle (available only), driver (available only), cargo weight, planned distance
- Lifecycle: Draft → Dispatched → Completed → Cancelled
- Validation: cargo weight ≤ vehicle max capacity (hard block, shown inline per mockup)
- Dispatch → vehicle + driver status = On Trip
- Complete → both revert to Available; capture final odometer + fuel consumed
- Cancel (from Dispatched) → both revert to Available

### 3.6 Maintenance
- Create service record → vehicle auto-status = In Shop, removed from dispatch pool
- Close maintenance → vehicle reverts to Available (unless Retired)

### 3.7 Fuel & Expense Management
- Fuel logs: liters, cost, date, vehicle
- Other expenses: tolls, misc, linked to trip/vehicle
- Auto-computed Total Operational Cost = Fuel + Maintenance, per vehicle

### 3.8 Reports & Analytics
- Fuel Efficiency (Distance/Fuel)
- Fleet Utilization %
- Operational Cost
- Vehicle ROI = (Revenue − (Maintenance + Fuel)) / Acquisition Cost
- CSV export (mandatory); PDF export optional

### 3.9 Settings & RBAC
- Depot name, currency, distance unit
- Role-permission matrix (view/edit per module per role, per mockup Screen 8)

---

## 4. GenAI Features (P1)

All P1 features share one backend building block: a single LLM-wrapper service (`llm_service`) that takes structured JSON context + a task-specific prompt and returns structured text. Build this once, reuse for all three features below.

### 4.1 Live Fleet Map
**Where:** Dashboard (replaces/augments the static Vehicle Status bar) + Trip Dispatcher (route preview)

- Library: `react-leaflet` + OpenStreetMap tiles (free, no API key)
- Vehicle markers color-coded by status: green = Available, blue = On Trip, orange = In Shop, red = Retired
- Vehicle "current location" = last trip's destination, or home depot if idle
- On Trip Dispatcher: selecting Source + Destination draws a line between them and auto-fills Planned Distance
- **Implementation shortcut:** hardcode lat/lng for depot names already used in mockups (Gandhinagar Depot, Ahmedabad Hub, Vatva Industrial Area, Sanand Warehouse, Mansa, Kalol Depot). No live geocoding/routing API needed — straight-line/static polyline is sufficient for demo purposes.
- Backend: add `lat`/`lng` fields to Vehicle model; static depot lookup table.

### 4.2 AI Dispatch Advisor
**Where:** Trip Dispatcher screen, next to the driver/vehicle selection fields

- Button: "AI Suggest" — ranks top 1–3 valid vehicle+driver pairs with a one-line natural-language reason
- Reuses existing eligibility filtering logic (capacity check, license validity, On Trip exclusion, safety score) — the LLM only ranks and explains an already-filtered candidate list, it does not re-derive eligibility
- Example output: *"Recommended: Van-05 + Alex — capacity fits with 50kg margin, 96% safety score, no active trips. Avoid Truck-11 — currently On Trip."*
- Endpoint: `POST /api/trips/suggest` — payload: eligible vehicles, eligible drivers, cargo weight, distance → single LLM call → structured ranked response

### 4.3 AI Daily Ops Briefing
**Where:** Dashboard, top card

- 3–4 sentence auto-generated summary from current KPIs, recent trips, and flagged items (expiring licenses, vehicles in shop too long, cost spikes)
- Example: *"Fleet utilization is at 81%. Driver John's license expired 3/25/2025 and he is blocked from dispatch. Truck-11 has generated ₹28,750 in maintenance+fuel this month — the highest in the fleet."*
- Endpoint: `POST /api/dashboard/briefing` — reuses same `llm_service`, cache response for a few minutes (not regenerated on every page load)

### 4.4 "Ask TransitOps" Chat Widget (P2 — build only if ahead of schedule)
- Floating chat icon, available globally
- User asks natural-language questions ("which drivers have expiring licenses this month?"); backend passes the question + a snapshot of relevant tables (vehicles, drivers, trips, expenses) as LLM context, no vector DB / RAG — keep it to direct context-stuffing
- Treat as optional polish, not a commitment

---

## 5. Moonshot — Control Tower (P3, lowest priority)

**Only attempt if P0 + P1 are fully working and demo-tested, with time remaining.**

Autonomous dispatch mode layered on top of the AI Dispatch Advisor and the Live Fleet Map — no new subsystems, just recombination:

- Toggle on Dashboard: **Manual / Autopilot**
- In Autopilot: incoming trip requests are evaluated automatically using the same eligibility logic + LLM ranking from 4.2. If confidence/fit is high (e.g. single unambiguous eligible pair, no conflicts), the agent **auto-dispatches** without human click.
- Edge cases (capacity conflict, no eligible driver, ambiguous best choice) are **escalated** to a pending queue for manual review — never silently auto-approved on a conflict.
- Live event feed (scrolling log) narrates agent decisions in real time: *"Trip TR007 → Van-05 + Alex — auto-approved, high confidence."* / *"Trip TR008 held — no eligible driver in region, escalating for review."*
- Map markers animate along routes (simple `setInterval` position interpolation between source/destination — no real GPS/telemetry needed)
- Demo sequence: start Manual, dispatch one trip by hand → flip to Autopilot → fire 3–4 pre-seeded trip requests → show one auto-approved, one correctly escalated on a real conflict (e.g. cargo over capacity)

**Do not start this until P0/P1 are stable.** If time runs out, Control Tower is simply not shown — the rest of the platform stands on its own.

---

## 6. Team Split & Time Budget (6–7 hrs)

| Hour | Backend Dev 1 | Backend Dev 2 | Frontend Dev |
|---|---|---|---|
| 0–1 | Auth/RBAC + schema | Vehicle/Driver/Trip CRUD APIs | Login, Dashboard shell, nav |
| 1–2.5 | Trip lifecycle + status transition rules | Maintenance + Fuel/Expense APIs + cost calc | Vehicle Registry, Drivers, Trip Dispatcher UI |
| 2.5–4 | Reports/analytics endpoints | Build `llm_service` + **AI Dispatch Advisor** endpoint | **Live Fleet Map** integration (Leaflet) |
| 4–5 | Bug fixes, edge cases, seed data | **AI Daily Briefing** endpoint | Wire AI Suggest button + briefing card into UI |
| 5–6 | *(if ahead)* support Control Tower backend logic | *(if ahead)* Chat widget, or Control Tower agent loop | *(if ahead)* Autopilot toggle + event feed UI |
| 6–7 | Full team: demo run-through, fallback checks, polish | | |

**Fallback requirement:** cache one pre-generated response each for the Dispatch Advisor and Daily Briefing (against seed data) so a slow/failed live LLM call during judging falls back silently instead of hanging the UI.

---

## 7. Data Model Additions (beyond mandatory entities)

Mandatory entities: Users, Roles, Vehicles, Drivers, Trips, Maintenance Logs, Fuel Logs, Expenses

Additions for P1/P3 features:
- `Vehicle.lat`, `Vehicle.lng` — current location
- `Depot` lookup table — static name → lat/lng mapping
- `BriefingCache` — cached AI briefing text + generated_at timestamp
- `DispatchSuggestion` (optional, log table) — trip_id, suggested_vehicle, suggested_driver, reason, accepted (bool) — useful for demo storytelling ("AI suggested correctly 8/10 times")
- (P3 only) `TripRequest` queue — for autopilot pending/escalated items, distinct from a normal Draft trip

---

## 8. API Endpoints (additions to core CRUD)

| Endpoint | Purpose |
|---|---|
| `POST /api/trips/suggest` | AI Dispatch Advisor — ranked candidates + reasoning |
| `POST /api/dashboard/briefing` | AI Daily Ops Briefing (cached) |
| `GET /api/fleet/locations` | Vehicle lat/lng for map rendering |
| `POST /api/chat/ask` | (P2) Ask TransitOps — Q&A over fleet context |
| `POST /api/trips/autopilot/toggle` | (P3) Enable/disable autonomous dispatch |
| `GET /api/trips/autopilot/feed` | (P3) Streaming/polling event feed for agent narration |

---

## 9. Demo Script (target 3–4 minutes)

1. Login as Dispatcher → Dashboard: point out Daily Briefing card + live map with color-coded vehicles
2. Trip Dispatcher: create a trip, click **AI Suggest** → show ranked recommendation with reasoning
3. Try to overload cargo capacity → show hard validation block (mandatory rule, but visually reinforces trust in the AI suggestion)
4. Dispatch → show vehicle/driver flip to On Trip live on the map
5. Complete a trip → Maintenance → show auto status transition to In Shop, vehicle disappears from dispatch pool
6. Reports: show fuel efficiency / ROI numbers auto-calculated
7. **If Control Tower was built:** flip Autopilot on, fire pre-seeded requests, show one auto-approved + one correctly escalated

---

## 10. Explicit Cut List (do not attempt in this hackathon)

- Real GPS/live vehicle telemetry
- Real routing/geocoding API integration
- Predictive maintenance via trained ML model (use simple heuristic dressed as insight only if time allows, not a priority)
- Voice input
- RAG/vector DB for the chat widget
- PDF export (marked optional in spec — CSV only unless time allows)
- Email reminders for license expiry (bonus in spec, not core)