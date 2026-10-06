# ScamShield AI 🛡️

## Payment‑Safety Operations Dashboard

**ScamShield AI** detects UPI payment scams **before** a user authorizes payment. An operator can enter payment context or scan a UPI QR code, have the app assess scam and social‑engineering signals, and review an actionable risk decision before payment authorization.

> ⚠️ **Decision support only.** Never initiate, authorize, or transfer a payment. Do not claim to check a live global spam or fraud database unless a real data provider is configured. All signals are locally evaluated.

---
## ✨ Features

| Feature | Description |
|---|---|
| **📊 Live Evaluation** | Enter amount (INR), VPA, optional note, active‑call/first‑time‑payee toggles. Four presets: Critical Scam → **BLOCK**, High Risk → **BLOCK**, Moderate Risk → **WARN**, Clean Payment → **ALLOW**. |
| **📸 UPI QR Scanning** | Camera + image upload tabs. Parses `upi://pay?...` links, extracts `pa`, `pn`, `am`, `cu`, `tn`, `tr`/`tid`. Validates INR only. Never auto‑submits. |
| **📈 Risk Scoring** | Transparent weighted score (0–100). Decision bands: **ALLOW** 0–39, **WARN** 40–74, **BLOCK** 75–100. Explainable factors with weights and details. |
| **📁 Audit Trail** | Persisted evaluations with timestamp, VPA, amount, note, decision, score, factors. Refreshable dashboard. |
| **📊 Risk Monitors** | Real decision distribution from API aggregates. Thresholds displayed. Flagged VPAs list. No static demo counts. |
| **🌐 Three Routes** | `/` Live evaluation • `/audit` Activity history • `/signals` Risk monitor • Fixed sidebar, overlay on mobile. |

---

## 🛠 Technology Stack

| Layer | Tech |
|---|---|
| **Frontend** | React, TypeScript, Vite, pnpm, React Router 6 |
| **Backend** | Python, FastAPI, Uvicorn |
| **NLP** | spaCy `en_core_web_sm` for intent detection |
| **Persistence** | SQLAlchemy + SQLite (`backend/scamshield.db`) |
| **QR Decoding** | jsQR + native BarcodeDetector fallback (Safari/older browsers) |

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m spacy download en_core_web_sm          # one‑time
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev                                          # opens http://localhost:5173
```

> The frontend proxies `/api/*` → `http://localhost:8000`.

### Verify

```bash
# Backend health
curl http://localhost:8000/api/healthz
# → {"status":"ok"}

# Frontend
open http://localhost:5173
```

---

## 📦 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/v1/evaluate-transaction` | Evaluate a payment; returns decision, score, factors, transaction ID |
| `GET` | `/api/v1/audit-logs?limit=20` | Recent evaluations (validated limit 1–200) |
| `GET` | `/api/v1/dashboard-summary` | Aggregates: total, allow/warn/block counts, flagged VPAs |
| `GET` | `/api/v1/risk-signals` | Thresholds, decision distribution, flagged VPAs |

OpenAPI docs: `http://localhost:8000/docs`

---

## 🎯 Scenario Presets

| Preset | Amount | VPA | Note | Call | First‑time | Expected |
|---|---|---|---|---|---|---|
| **Critical Scam** | ₹1 | `pay-kyc-verify@fastpkr` | Send 1 to verify your KYC | ✅ | ✅ | **BLOCK** |
| **High Risk** | ₹4,999 | `power-bill-support@pay` | Urgent electricity disconnect notice | ✅ | ✅ | **BLOCK** |
| **Moderate Risk** | ₹500 | `refund-desk@upi` | Claim lottery refund | ❌ | ✅ | **WARN** |
| **Clean Payment** | ₹250 | `alex@okaxis` | Dinner split | ❌ | ❌ | **ALLOW** |

---

## 📁 Project Structure

```
scamshield/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI + endpoints
│   │   ├── risk.py          # Weighted scoring engine
│   │   ├── nlp.py           # spaCy intent detection
│   │   ├── db.py            # SQLAlchemy engine/session
│   │   ├── models.py        # ORM models
│   │   └── schemas.py       # Pydantic request/response
│   └── tests/
│       ├── conftest.py      # Test DB fixture
│       ├── test_risk.py     # Scoring + presets
│       └── test_api.py      # Endpoints + persistence
├── frontend/
│   ├── src/
│   │   ├── api.ts           # Typed API client
│   │   ├── lib/upi.ts       # UPI link parsing + tests
│   │   ├── components/
│   │   │   └── QrScanner.tsx  # Camera + upload decoder
│   │   ├── pages/
│   │   │   ├── LiveEvaluate.tsx
│   │   │   ├── Audit.tsx
│   │   │   └── Signals.tsx
│   │   ├── App.tsx          # Routes + sidebar layout
│   │   ├── styles.css       # Professional design system
│   │   └── main.tsx         # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── README.md          # This file
└── .gitignore
```

---

## ⚠️ Limitations

- **No external reputation feeds** (Spamhaus, Truecaller, etc.) — flagged VPAs are local only
- **spaCy model required** — `python -m spacy download en_core_web_sm` (backend fails fast with clear error if missing)
- **QR scanning** needs HTTPS or localhost for camera access (browser policy)
- **No authentication/authorization** — intended for internal operator use
- **Decision support only** — never initiates/authorizes payments

---

## 🐞 Known Issues / Future Work

- Integrate external fraud APIs (with proper data‑provider configuration)
- Add user authentication + role‑based access
- Extend currency support beyond INR
- Export audit data (CSV/Excel)
- Real‑time score updates via WebSockets

---

## 📜 License

Internal use — payment‑safety operations tooling.

---

**Built with ❤️ for safer UPI payments.**
