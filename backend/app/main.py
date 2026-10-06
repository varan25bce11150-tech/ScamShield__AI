from __future__ import annotations

import json

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas
from .db import get_session, init_db
from .nlp import detect_intent, load_nlp
from .risk import assess_payment

app = FastAPI(title="ScamShield AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    load_nlp()  # fail fast with a useful error if the spaCy model is missing


@app.get("/api/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post("/api/v1/evaluate-transaction", response_model=schemas.EvaluateResponse)
def evaluate(req: schemas.EvaluateRequest, db: Session = Depends(get_session)) -> schemas.EvaluateResponse:
    intent = detect_intent(req.note)
    flagged = db.get(models.FlaggedVpa, req.vpa) is not None
    assessment = assess_payment(
        amount=req.amount,
        vpa=req.vpa,
        note=req.note,
        is_active_call=req.is_active_call,
        is_first_time_payee=req.is_first_time_payee,
        intent=intent,
        vpa_flagged=flagged,
    )

    log = models.TransactionLog(
        amount=req.amount,
        vpa=req.vpa,
        payee_name=req.payee_name,
        note=req.note,
        is_active_call=int(req.is_active_call),
        is_first_time_payee=int(req.is_first_time_payee),
        intent_label=intent.label,
        decision=assessment.decision,
        risk_score=assessment.score,
        advisory=assessment.advisory,
        factors_json=json.dumps([f.__dict__ for f in assessment.factors]),
    )
    db.add(log)

    if assessment.decision == "BLOCK":
        existing = db.get(models.FlaggedVpa, req.vpa)
        if existing is None:
            db.add(models.FlaggedVpa(vpa=req.vpa, reason=f"Blocked with score {assessment.score}: {assessment.factors[0].label if assessment.factors else 'risk'}"))
        else:
            existing.flags += 1
    db.commit()
    db.refresh(log)

    return schemas.EvaluateResponse(
        transaction_id=log.id,
        timestamp=log.created_at,
        amount=log.amount,
        vpa=log.vpa,
        decision=assessment.decision,
        risk_score=assessment.score,
        advisory=assessment.advisory,
        intent_label=intent.label,
        intent_matches=intent.matched_terms,
        factors=[schemas.FactorOut(**f.__dict__) for f in assessment.factors],
    )


def _audit_out(log: models.TransactionLog) -> schemas.AuditLogOut:
    return schemas.AuditLogOut(
        transaction_id=log.id,
        timestamp=log.created_at,
        amount=log.amount,
        vpa=log.vpa,
        note=log.note,
        is_active_call=bool(log.is_active_call),
        is_first_time_payee=bool(log.is_first_time_payee),
        decision=log.decision,
        risk_score=log.risk_score,
        advisory=log.advisory,
        intent_label=log.intent_label,
    )


@app.get("/api/v1/audit-logs", response_model=list[schemas.AuditLogOut])
def audit_logs(limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_session)) -> list[schemas.AuditLogOut]:
    rows = db.scalars(select(models.TransactionLog).order_by(models.TransactionLog.created_at.desc()).limit(limit)).all()
    return [_audit_out(r) for r in rows]


@app.get("/api/v1/dashboard-summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_session)) -> schemas.DashboardSummary:
    total = db.scalar(select(func.count()).select_from(models.TransactionLog)) or 0
    counts = dict(db.execute(select(models.TransactionLog.decision, func.count()).group_by(models.TransactionLog.decision)).all())
    flagged = db.scalar(select(func.count()).select_from(models.FlaggedVpa)) or 0
    recent_blocked = db.scalars(
        select(models.TransactionLog)
        .where(models.TransactionLog.decision == "BLOCK")
        .order_by(models.TransactionLog.created_at.desc())
        .limit(5)
    ).all()
    return schemas.DashboardSummary(
        total_evaluations=total,
        allow_count=counts.get("ALLOW", 0),
        warn_count=counts.get("WARN", 0),
        block_count=counts.get("BLOCK", 0),
        flagged_vpa_count=flagged,
        recent_blocked=[_audit_out(r) for r in recent_blocked],
    )


@app.get("/api/v1/risk-signals", response_model=schemas.RiskSignalsResponse)
def risk_signals(db: Session = Depends(get_session)) -> schemas.RiskSignalsResponse:
    counts = dict(db.execute(select(models.TransactionLog.decision, func.count()).group_by(models.TransactionLog.decision)).all())
    vpas = [r[0] for r in db.execute(select(models.FlaggedVpa.vpa).order_by(models.FlaggedVpa.updated_at.desc())).all()]
    return schemas.RiskSignalsResponse(
        thresholds={"ALLOW": "0-39", "WARN": "40-74", "BLOCK": "75-100"},
        distribution={"ALLOW": counts.get("ALLOW", 0), "WARN": counts.get("WARN", 0), "BLOCK": counts.get("BLOCK", 0)},
        flagged_vpas=vpas,
    )
