"""spaCy-based payment note intent detection.

Classifies a payment note into one of: kyc_pressure, urgent_utility,
lottery_refund, coercion, or neutral. Loads en_core_web_sm explicitly and
raises a useful error at startup if the model is missing.
"""
from __future__ import annotations

from dataclasses import dataclass

INTENT_KEYWORDS: dict[str, set[str]] = {
    "kyc_pressure": {"kyc", "verify", "verification", "re-kyc", "rekyc", "pan", "aadhaar", "account-update", "update"},
    "urgent_utility": {"urgent", "electricity", "disconnect", "disconnection", "power", "gas", "water", "bill", "fine", "penalty", "complaint"},
    "lottery_refund": {"lottery", "refund", "claim", "prize", "won", "winner", "cashback", "reward", "gift", "bonus"},
    "coercion": {"immediately", "blocked", "suspended", "deactivate", "disconnected", "threat", "arrest", "legal", "notice", "final"},
}

_nlp = None


def load_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except (ImportError, OSError) as exc:
            raise RuntimeError(
                "spaCy model 'en_core_web_sm' is required. Install with: "
                "pip install spacy && python -m spacy download en_core_web_sm"
            ) from exc
    return _nlp


@dataclass
class IntentResult:
    label: str
    matched_terms: list[str]


def detect_intent(note: str | None) -> IntentResult:
    if not note or not note.strip():
        return IntentResult(label="neutral", matched_terms=[])
    nlp = load_nlp()
    doc = nlp(note.lower())
    tokens = {t.lemma_ for t in doc} | {t.text for t in doc}
    for intent in ("kyc_pressure", "urgent_utility", "lottery_refund", "coercion"):
        matched = sorted(set(INTENT_KEYWORDS[intent]) & tokens)
        if matched:
            return IntentResult(label=intent, matched_terms=matched)
    # substring fallback for compound words like "re-kyc-verify"
    lowered = note.lower()
    for intent in ("kyc_pressure", "urgent_utility", "lottery_refund", "coercion"):
        matched = sorted(k for k in INTENT_KEYWORDS[intent] if k in lowered)
        if matched:
            return IntentResult(label=intent, matched_terms=matched)
    return IntentResult(label="neutral", matched_terms=[])
