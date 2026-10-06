from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

VPA_RE = re.compile(r"^[\w.\-]{2,}@[a-zA-Z][\w.\-]{1,}$")


class EvaluateRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10_000_000, description="Amount in INR")
    vpa: str = Field(..., min_length=3, max_length=255)
    note: str | None = Field(default=None, max_length=500)
    payee_name: str | None = Field(default=None, max_length=255)
    is_active_call: bool = False
    is_first_time_payee: bool = False

    @field_validator("vpa")
    @classmethod
    def _vpa_format(cls, v: str) -> str:
        v = v.strip()
        if not VPA_RE.match(v):
            raise ValueError("VPA must look like 'name@bank'")
        return v


class FactorOut(BaseModel):
    code: str
    label: str
    weight: int
    detail: str


class EvaluateResponse(BaseModel):
    transaction_id: str
    timestamp: datetime
    amount: float
    vpa: str
    decision: Literal["ALLOW", "WARN", "BLOCK"]
    risk_score: int = Field(..., ge=0, le=100)
    advisory: str
    intent_label: str
    intent_matches: list[str]
    factors: list[FactorOut]


class AuditLogOut(BaseModel):
    transaction_id: str
    timestamp: datetime
    amount: float
    vpa: str
    note: str | None
    is_active_call: bool
    is_first_time_payee: bool
    decision: str
    risk_score: int
    advisory: str
    intent_label: str


class DashboardSummary(BaseModel):
    total_evaluations: int
    allow_count: int
    warn_count: int
    block_count: int
    flagged_vpa_count: int
    recent_blocked: list[AuditLogOut]


class RiskSignalsResponse(BaseModel):
    thresholds: dict[str, str]
    distribution: dict[str, int]
    flagged_vpas: list[str]
