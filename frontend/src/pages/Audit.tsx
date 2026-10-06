import { useCallback, useEffect, useState } from "react";
import { api, type AuditLog } from "../api";

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await api.auditLogs(50));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("audit-refresh", refresh);
    return () => window.removeEventListener("audit-refresh", refresh);
  }, [load]);

  return (
    <section aria-labelledby="audit-heading">
      <div className="page-head">
        <h1 id="audit-heading">Audit activity</h1>
        <button className="btn btn-secondary" onClick={() => void load()}>Refresh</button>
      </div>

      {loading && <p role="status">Loading audit activity…</p>}
      {error && (
        <div role="alert" className="error-card">
          <p>Could not load audit logs: {error}</p>
          <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loading && !error && logs && logs.length === 0 && (
        <p className="empty">No evaluations recorded yet. Run a live evaluation to populate the audit trail.</p>
      )}
      {!loading && !error && logs && logs.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">VPA</th>
                <th scope="col">Amount</th>
                <th scope="col">Note</th>
                <th scope="col">Decision</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.transaction_id}>
                  <td>{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.vpa}</td>
                  <td>₹{l.amount}</td>
                  <td>{l.note ?? "—"}</td>
                  <td><span className={`badge ${l.decision.toLowerCase()}`}>{l.decision}</span></td>
                  <td>{l.risk_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}