from pydantic import BaseModel

class DashboardResponse(BaseModel):
    total_vehicles: int
    available_vehicles: int
    vehicles_on_trip: int
    vehicles_in_shop: int
    vehicles_retired: int
    fleet_utilization_pct: float
    active_trips: int
    pending_trips: int
    drivers_on_duty: int
    drivers_available: int
