"""fix_vw_vehicle_cost_summary

Revision ID: 7dfae4f932a2
Revises: 
Create Date: 2026-07-12 11:18:34.826999

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7dfae4f932a2'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW vw_vehicle_cost_summary AS
        SELECT
          v.id AS vehicle_id,
          v.registration_number,
          v.name,
          v.acquisition_cost,
          COALESCE(fl.total_fuel_cost, 0) AS total_fuel_cost,
          COALESCE(ml.total_maintenance_cost, 0) AS total_maintenance_cost,
          COALESCE(fl.total_fuel_cost, 0) + COALESCE(ml.total_maintenance_cost, 0) AS total_operational_cost,
          COALESCE(t.total_revenue, 0) AS total_revenue,
          ROUND(
            (COALESCE(t.total_revenue, 0) - (COALESCE(fl.total_fuel_cost, 0) + COALESCE(ml.total_maintenance_cost, 0)))
            / NULLIF(v.acquisition_cost, 0), 4
          ) AS roi
        FROM vehicles v
        LEFT JOIN (SELECT vehicle_id, SUM(total_cost) AS total_fuel_cost FROM fuel_logs GROUP BY vehicle_id) fl
          ON fl.vehicle_id = v.id
        LEFT JOIN (SELECT vehicle_id, SUM(cost) AS total_maintenance_cost FROM maintenance_logs GROUP BY vehicle_id) ml
          ON ml.vehicle_id = v.id
        LEFT JOIN (SELECT vehicle_id, SUM(revenue) AS total_revenue FROM trips WHERE status = 'completed' GROUP BY vehicle_id) t
          ON t.vehicle_id = v.id;
    """)


def downgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW vw_vehicle_cost_summary AS
        SELECT
          v.id                        AS vehicle_id,
          v.registration_number,
          v.name,
          v.acquisition_cost,
          COALESCE(SUM(fl.total_cost), 0)  AS total_fuel_cost,
          COALESCE(SUM(ml.cost), 0)        AS total_maintenance_cost,
          COALESCE(SUM(fl.total_cost), 0) + COALESCE(SUM(ml.cost), 0) AS total_operational_cost,
          COALESCE(SUM(t.revenue), 0)      AS total_revenue,
          ROUND(
            (COALESCE(SUM(t.revenue), 0)
              - (COALESCE(SUM(fl.total_cost), 0) + COALESCE(SUM(ml.cost), 0)))
            / NULLIF(v.acquisition_cost, 0), 4
          )                                AS roi
        FROM vehicles v
        LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
        LEFT JOIN maintenance_logs ml ON ml.vehicle_id = v.id
        LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'completed'
        GROUP BY v.id, v.registration_number, v.name, v.acquisition_cost;
    """)
