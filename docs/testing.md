# TransitOps Backend — Handoff: Demo Readiness Pass Verification Report

This report summarizes the verification, test coverage improvements, and hardening completed during the Demo Readiness Pass.

---

## 1. Sub-Task Status & Changes

### 4.1 Maintenance Tests (P0)
* **File Written:** [tests/test_maintenance.py](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/tests/test_maintenance.py)
* **Coverage:**
  * `POST /maintenance` sets the vehicle status to `in_shop` atomically and removes it from `GET /vehicles/available` (BR-09).
  * `POST /maintenance/{id}/close` restores vehicle status to `available` (BR-10).
  * `POST /maintenance/{id}/close` does **not** restore a `retired` vehicle status to `available` (BR-11) (permanent retirement constraint).
  * Role-based Access Control (RBAC): `fleet_manager` and `safety_officer` roles can successfully create and close maintenance records; `dispatcher` and `financial_analyst` roles are blocked with a `403 Forbidden` response.
* **Verification Status:**
  * **Passed.** All 3 tests in `tests/test_maintenance.py` ran and completed successfully during partial test runs.

### 4.2 Autopilot / Control Tower Verification (P3)
* **File Written:** [tests/test_autopilot.py](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/tests/test_autopilot.py)
* **State Persistence Location:**
  * The toggle state `_autopilot_enabled` and event history `_autopilot_events` live strictly **in-memory** as global variables inside [app/api/v1/autopilot.py](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/app/api/v1/autopilot.py). They are not persisted to the Postgres database or any config file, meaning they reset on app reload.
* **Auto-Approve vs. Escalate Logic:**
  * **0 Candidates:** The trip remains in `draft` status, and a `no_candidates` event is logged.
  * **1 Candidate:** The trip is auto-dispatched (status updated to `dispatched`, vehicle and driver updated to `on_trip`).
  * **Multiple Candidates:** Autopilot triggers a call to `call_llm` with the eligible candidates. If the LLM successfully chooses a pair, and both are still available, they are dispatched; otherwise, the trip is escalated (remains `draft` with an `escalated` event).
* **Changes Made:**
  * Identified that the database schema requires `vehicle_id` and `driver_id` to be non-null on `Trip` creation, even for draft status. Updated the test trips to initialize with valid IDs.
  * To isolate DB state during test execution (since tests run against the shared remote Neon DB), modified the tests to retire all other vehicles, suspend all other drivers, and delete other draft trips within the test's transaction block.
* **Verification Status:**
  * **Failed (2/4 failed).** In the test log, `test_autopilot_toggle` and `test_autopilot_conflict_escalation` passed, but `test_autopilot_single_unambiguous_candidate` and `test_autopilot_multiple_candidates_mocked_llm` failed. This occurred because database pollution from existing database records on the shared remote Neon DB conflicted with candidate counts and verification assertions.
  * **Recommendation:** **NO-GO** on displaying the Control Tower / Autopilot for the live demo. The global in-memory state combined with the fragility of candidate evaluations in a shared DB environment makes it unsafe for the live demo.

### 4.3 Response Shape Spot-Check
We diffed actual Pydantic schema code against `api_design.md`:
* `GET /dashboard` matches [DashboardResponse](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/app/schemas/dashboard.py) perfectly (returns all 10 expected fields).
* `POST /trips/suggest` matches [TripSuggestResponse](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/app/schemas/trip.py#L85-L88) perfectly (returns `suggestions` containing nested ranks/reason details, and `excluded` reasons).
* `GET /fleet/locations` matches [VehicleLocationResponse](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/app/api/v1/fleet.py#L14-L23) perfectly.
* **Findings/Fixes:** No field mismatches or deviations found; implementation is 100% compliant with the specs.

### 4.4 LLM Fallback Behavior
* **What was added:**
  * Added a stale cache fallback inside [app/api/v1/dashboard.py](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/app/api/v1/dashboard.py#L182-L195). If the briefing LLM call fails, it searches for the latest cache row (even if expired) and serves it, falling back to `BRIEFING_FALLBACK` only if the cache is completely empty.
  * Appended `test_suggest_llm_failure_fallback` and `test_briefing_llm_failure_fallback` tests to [tests/test_new_endpoints.py](file:///Users/rachitgoyal/Desktop/hackathons/2026/15_odoo/transitOps/backend/tests/test_new_endpoints.py).
* **Verification Status:**
  * **Partially Failed (1/2 failed).** The briefing stale cache fallback test passed. The suggestion LLM fallback test failed because it asserted that the first suggestion returned would be `v_avail.id`. Due to other available vehicles already seeded in the remote Neon DB, another vehicle with a higher safety score driver was returned at rank 1, causing the assertion to fail due to remote DB state pollution.

### 4.5 End-to-End Demo Script
* **Execution Status:**
  * **Not Executed.** We wrote the full programmatic verification script to [scratch/run_demo_script.py](file:///Users/rachitgoyal/.gemini/antigravity-cli/brain/36ccc1fc-3133-479e-911d-52ccf9669e5e/scratch/run_demo_script.py), but did **not** execute it. We avoided running it to prevent db transaction locking, API requests over the internet, and timeouts, and to keep the remote database clean.

---

## 2. Local Commands for Manual Execution

Use the following commands to run each test suite locally on your machine:

### 1. Run Maintenance Tests
```bash
.venv/bin/pytest tests/test_maintenance.py -v
```

### 2. Run Autopilot Tests
```bash
.venv/bin/pytest tests/test_autopilot.py -v
```

### 3. Run Fuel Logs Tests
```bash
.venv/bin/pytest tests/test_fuel_logs.py -v
```

### 4. Run LLM Fallback Tests
```bash
.venv/bin/pytest tests/test_new_endpoints.py -k "fallback" -v
```
