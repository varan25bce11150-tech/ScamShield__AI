import { useState } from "react";
import { api, type EvaluateResponse } from "../api";
import QrScanner from "../components/QrScanner";
import type { UpiPayment } from "../lib/upi";

const PRESETS = [
  {
    label: "Critical Scam",
    values: { amount: "1", vpa: "pay-kyc-verify@fastpkr", note: "Send 1 to verify your KYC", activeCall: true, firstTime: true },
  },
  {
    label: "High Risk",
    values: { amount: "4999", vpa: "power-bill-support@pay", note: "Urgent electricity disconnect notice", activeCall: true, firstTime: true },
  },
  {
    label: "Moderate Risk",
    values: { amount: "500", vpa: "refund-desk@upi", note: "Claim lottery refund", activeCall: false, firstTime: true },
  },
  {
    label: "Clean Payment",
    values: { amount: "250", vpa: "alex@okaxis", note: "Dinner split", activeCall: false, firstTime: false },
  },
];

const DECISION_CLASS: Record<string, string> = {
  ALLOW: "badge allow",
  WARN: "badge warn",
  BLOCK: "badge block",
};

export default function LiveEvaluate() {
  const [amountInput, setAmountInput] = useState("");
  const [vpa, setVpa] = useState("");
  const [note, setNote] = useState("");
  const [activeCall, setActiveCall] = useState(false);
  const [firstTime, setFirstTime] = useState(true);
  const [payeeName, setPayeeName] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setAmountInput(p.values.amount);
    setVpa(p.values.vpa);
    setNote(p.values.note);
    setActiveCall(p.values.activeCall);
    setFirstTime(p.values.firstTime);
    setPayeeName(null);
    setReference(null);
    setError(null);
  };

  const handleDecoded = (payment: UpiPayment) => {
    setVpa(payment.vpa);
    setNote(payment.note ?? "");
    setAmountInput(payment.amount !== null ? String(payment.amount) : "");
    setPayeeName(payment.payeeName);
    setReference(payment.reference);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = amountInput.trim();
    if (trimmed === "") {
      setError("Enter an amount in INR before evaluating.");
      return;
    }
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (!vpa.trim()) {
      setError("Enter a recipient VPA.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.evaluate({
        amount,
        vpa: vpa.trim(),
        note: note.trim() || undefined,
        payee_name: payeeName ?? undefined,
        is_active_call: activeCall,
        is_first_time_payee: firstTime,
      });
      setResult(res);
      setCopied(false);
      window.dispatchEvent(new Event("audit-refresh"));
    } catch (err) {
      setError(`Evaluation failed. Check the backend is running, then retry.`);
    } finally {
      setSubmitting(false);
    }
  };

  const copyId = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.transaction_id);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="live-heading">
      <h1 id="live-heading">Live evaluation</h1>
      <p className="lede">Assess a UPI payment for scam and social-engineering signals before authorizing it. No payment is initiated.</p>

      <div className="presets" aria-label="Scenario presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="preset-btn" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <div className="amount-wrap">
              <span className="amount-prefix" aria-hidden="true">₹</span>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="vpa">Recipient VPA</label>
            <input id="vpa" type="text" placeholder="name@bank" value={vpa} onChange={(e) => setVpa(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">Payment note (optional)</label>
          <input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
        </div>
        <div className="toggles">
          <label className="toggle">
            <input type="checkbox" checked={activeCall} onChange={(e) => setActiveCall(e.target.checked)} />
            Active call during payment
          </label>
          <label className="toggle">
            <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
            First-time payee
          </label>
        </div>

        {(payeeName || reference) && (
          <p className="decoded-meta" role="status">
            Decoded from QR — payee{payeeName ? `: ${payeeName}` : ""}
            {reference ? ` · reference: ${reference}` : ""}. Review the fields, then evaluate.
          </p>
        )}

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Evaluating…" : "Evaluate risk"}
          </button>
          <QrScanner onDecoded={handleDecoded} />
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>

      {submitting && <p className="status" role="status">Analyzing payment context…</p>}

      {result && (
        <div className="result-card">
          <div className="result-head">
            <span className={DECISION_CLASS[result.decision]}>{result.decision}</span>
            <span className="score" aria-label={`Risk score ${result.risk_score} out of 100`}>{result.risk_score}/100</span>
          </div>
          <p className="advisory">{result.advisory}</p>
          <dl className="meta">
            <div><dt>Transaction ID</dt><dd><code>{result.transaction_id}</code> <button type="button" className="btn btn-chip" onClick={copyId}>{copied ? "Copied ✓" : "Copy"}</button></dd></div>
            <div><dt>Timestamp</dt><dd>{new Date(result.timestamp).toLocaleString()}</dd></div>
            <div><dt>Amount</dt><dd>₹{result.amount}</dd></div>
            <div><dt>VPA</dt><dd>{result.vpa}</dd></div>
            <div><dt>Note intent</dt><dd>{result.intent_label}{result.intent_matches.length ? ` (${result.intent_matches.join(", ")})` : ""}</dd></div>
          </dl>
          <h2>Risk factors</h2>
          {result.factors.length === 0 ? (
            <p>No risk factors triggered.</p>
          ) : (
            <ul className="factors">
              {result.factors.map((f) => (
                <li key={f.code}>
                  <strong>{f.label}</strong> {f.weight > 0 ? `+${f.weight}` : "(info)"} — {f.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}