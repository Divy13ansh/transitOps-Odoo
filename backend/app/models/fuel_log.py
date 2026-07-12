import uuid
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import Numeric, Date, DateTime, ForeignKey, func, FetchedValue
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True)
    liters: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    cost_per_liter: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), server_default=FetchedValue())
    odometer_at_fill: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    filled_at: Mapped[date] = mapped_column(Date, default=date.today, server_default=func.current_date(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    vehicle = relationship("Vehicle")
    trip = relationship("Trip")
