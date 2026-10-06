"""Risk scoring engine for ScamShield AI.

Transparent, rule-based, explainable weighted scoring. Decision bands:
  ALLOW 0-39, WARN 40-74, BLOCK 75-100
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .nlp import IntentResult

FLAGGED_VPA_PATTERNS = ("kyc", "verify", "power-bill", "bill-support", "refund", "lottery", "support@pay")


@dataclass
class Factor:
    code: str
    label: str
    weight: int
    detail: str


@dataclass
class RiskAssessment:
    score: int
    decision: str
    advisory: str
    intent: IntentResult
    factors: list[Factor] = field(default_factory=list)


def decision_for_score(score: int) -> str:
    if score >= 75:
        return "BLOCK"
    if score >= 40:
        return "WARN"
    return "ALLOW"


def advisory_for(decision: str) -> str:
    return {
        "ALLOW": "No strong scam signals detected. Proceed only if you recognize the payee.",
        "WARN": "Some risk signals detected. Verify the payee identity and do not share OTPs or UPI PINs.",
        "BLOCK": "Strong scam indicators detected. Do not authorize this payment. Report the VPA if unsolicited.",
    }[decision]


def assess_payment(
    *,
    amount: float,
    vpa: str,
    note: str | None,
    is_active_call: bool,
    is_first_time_payee: bool,
    intent: IntentResult,
    vpa_flagged: bool,
) -> RiskAssessment:
    factors: list[Factor] = []
    score = 0

    def add(code: str, label: str, weight: int, detail: str) -> None:
        nonlocal score
        if weight > 0:
            factors.append(Factor(code=code, label=label, weight=weight, detail=detail))
            score += weight

    intent_weights = {
        "kyc_pressure": (35, "KYC/verification pressure language"),
        "urgent_utility": (30, "Urgent utility-threat language"),
        "lottery_refund": (25, "Lottery/refund lure language"),
        "coercion": (30, "Coercive payment language"),
    }
    if intent.label in intent_weights:
        w, label = intent_weights[intent.label]
        add("intent_" + intent.label, label, w, f"Detected intent '{intent.label}' in note: {(note or '').strip()!r}")

    vpa_lower = vpa.lower()
    risky_parts = [p for p in FLAGGED_VPA_PATTERNS if p in vpa_lower]
    if risky_parts:
        add("vpa_pattern", "High-risk VPA pattern", 20, f"VPA contains suspicious tokens: {', '.join(risky_parts)}")

    if vpa_flagged:
        add("vpa_flagged", "VPA previously flagged", 25, "This VPA was flagged in a prior evaluation.")

    if is_active_call:
        add("active_call", "Active call during payment", 15, "Payments made while on a call are a common scam vector.")

    if is_first_time_payee:
        add("first_time_payee", "First-time payee", 10, "No prior payment history with this payee.")

    if 0 < amount <= 10:
        add("micro_amount", "Micro-verification amount", 10, "Very small amounts are sometimes used to 'verify' accounts before fraud.")
    elif amount >= 10000 and is_first_time_payee:
        add("large_first_time", "Large first-time transfer", 15, "High-value first-time transfer to an unvetted payee.")

    if intent.label == "neutral":
        factors.append(Factor(code="intent_neutral", label="Neutral payment note", weight=0, detail="No scam language detected in the note."))

    score = max(0, min(100, score))
    decision = decision_for_score(score)
    return RiskAssessment(score=score, decision=decision, advisory=advisory_for(decision), intent=intent, factors=factors)
