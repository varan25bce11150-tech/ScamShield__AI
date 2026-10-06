from app.nlp import detect_intent
from app.risk import assess_payment, decision_for_score


def _assess(amount, vpa, note, call, first_time):
    return assess_payment(
        amount=amount, vpa=vpa, note=note, is_active_call=call,
        is_first_time_payee=first_time, intent=detect_intent(note), vpa_flagged=False,
    )


def test_decision_thresholds():
    assert decision_for_score(0) == "ALLOW"
    assert decision_for_score(39) == "ALLOW"
    assert decision_for_score(40) == "WARN"
    assert decision_for_score(74) == "WARN"
    assert decision_for_score(75) == "BLOCK"
    assert decision_for_score(100) == "BLOCK"


def test_critical_scam_preset_blocks():
    r = _assess(1, "pay-kyc-verify@fastpkr", "Send 1 to verify your KYC", True, True)
    assert r.decision == "BLOCK"
    assert r.score >= 75
    assert r.intent.label == "kyc_pressure"


def test_high_risk_preset_blocks():
    r = _assess(4999, "power-bill-support@pay", "Urgent electricity disconnect notice", True, True)
    assert r.decision == "BLOCK"
    assert r.score >= 75
    assert r.intent.label == "urgent_utility"


def test_moderate_risk_preset_warns():
    r = _assess(500, "refund-desk@upi", "Claim lottery refund", False, True)
    assert r.decision == "WARN"
    assert 40 <= r.score <= 74


def test_clean_payment_preset_allows():
    r = _assess(250, "alex@okaxis", "Dinner split", False, False)
    assert r.decision == "ALLOW"
    assert r.score <= 39
    assert r.intent.label == "neutral"


def test_factors_explain_score():
    r = _assess(1, "pay-kyc-verify@fastpkr", "Send 1 to verify your KYC", True, True)
    codes = {f.code for f in r.factors}
    assert "intent_kyc_pressure" in codes
    assert "active_call" in codes
    assert "first_time_payee" in codes
    assert sum(f.weight for f in r.factors) == r.score
