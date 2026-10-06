PRESETS = [
    dict(amount=1, vpa="pay-kyc-verify@fastpkr", note="Send 1 to verify your KYC", is_active_call=True, is_first_time_payee=True, expect="BLOCK"),
    dict(amount=4999, vpa="power-bill-support@pay", note="Urgent electricity disconnect notice", is_active_call=True, is_first_time_payee=True, expect="BLOCK"),
    dict(amount=500, vpa="refund-desk@upi", note="Claim lottery refund", is_active_call=False, is_first_time_payee=True, expect="WARN"),
    dict(amount=250, vpa="alex@okaxis", note="Dinner split", is_active_call=False, is_first_time_payee=False, expect="ALLOW"),
]


def test_healthz(client):
    r = client.get("/api/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_presets_end_to_end(client):
    for p in PRESETS:
        payload = {k: v for k, v in p.items() if k != "expect"}
        r = client.post("/api/v1/evaluate-transaction", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["decision"] == p["expect"], (p["vpa"], body["risk_score"], body["intent_label"])
        assert 0 <= body["risk_score"] <= 100
        assert body["transaction_id"]
        assert body["advisory"]
        assert isinstance(body["factors"], list) and body["factors"]


def test_evaluate_validation(client):
    assert client.post("/api/v1/evaluate-transaction", json={"amount": -5, "vpa": "alex@okaxis"}).status_code == 422
    assert client.post("/api/v1/evaluate-transaction", json={"amount": 100, "vpa": "not-a-vpa"}).status_code == 422
    assert client.post("/api/v1/evaluate-transaction", json={"vpa": "alex@okaxis"}).status_code == 422


def test_audit_persistence_and_limit(client):
    r = client.get("/api/v1/audit-logs", params={"limit": 100})
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) >= 4
    assert all({"transaction_id", "timestamp", "vpa", "amount", "decision", "risk_score"} <= set(l) for l in logs)
    assert client.get("/api/v1/audit-logs", params={"limit": 0}).status_code == 422
    assert client.get("/api/v1/audit-logs", params={"limit": 2}).json().__len__() == 2


def test_dashboard_aggregates(client):
    s = client.get("/api/v1/dashboard-summary").json()
    assert s["total_evaluations"] >= 4
    assert s["allow_count"] >= 1
    assert s["warn_count"] >= 1
    assert s["block_count"] >= 2
    assert s["flagged_vpa_count"] >= 1


def test_risk_signals_endpoint(client):
    r = client.get("/api/v1/risk-signals")
    assert r.status_code == 200
    body = r.json()
    assert body["thresholds"] == {"ALLOW": "0-39", "WARN": "40-74", "BLOCK": "75-100"}
    assert body["distribution"]["BLOCK"] >= 2
    assert isinstance(body["flagged_vpas"], list) and body["flagged_vpas"]


def test_flagged_vpa_raises_future_score(client):
    payload = {"amount": 20000, "vpa": "blocked-user@bank", "note": "Send to verify your KYC", "is_active_call": True, "is_first_time_payee": True}
    first = client.post("/api/v1/evaluate-transaction", json=payload).json()
    payload2 = {"amount": 20000, "vpa": "blocked-user@bank", "note": "Dinner", "is_active_call": False, "is_first_time_payee": False}
    second = client.post("/api/v1/evaluate-transaction", json=payload2).json()
    assert first["decision"] == "BLOCK"
    # second evaluation now carries the flagged-VPA factor, unlike a fresh clean VPA
    clean = client.post("/api/v1/evaluate-transaction", json={**payload2, "vpa": "someone@okaxis"}).json()
    assert second["risk_score"] > clean["risk_score"]
