from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TransactionLog(Base):
    __tablename__ = "transaction_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    vpa: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    payee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active_call: Mapped[int] = mapped_column(Integer, default=0)
    is_first_time_payee: Mapped[int] = mapped_column(Integer, default=0)
    intent_label: Mapped[str] = mapped_column(String(64), default="neutral")
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    advisory: Mapped[str] = mapped_column(Text, nullable=False)
    factors_json: Mapped[str] = mapped_column(Text, default="[]")


class FlaggedVpa(Base):
    __tablename__ = "flagged_vpas"

    vpa: Mapped[str] = mapped_column(String(255), primary_key=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    flags: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
