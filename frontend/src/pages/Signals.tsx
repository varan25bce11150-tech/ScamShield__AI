import { useCallback, useEffect, useState } from "react";
import { api, type RiskSignals } from "../api";

export default function Signals() {
  const [data, setData] = useState<RiskSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.riskSignals());
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

  const total = data ? data.distribution.ALLOW + data.distribution.WARN + data.distribution.BLOCK : 0;

  return (
    <section aria-labelledby="signals-heading">
      <div className="page-head">
        <h1 id="signals-heading">Risk signals</h1>
        <button className="btn btn-secondary" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="card">
        <h2>Decision thresholds</h2>
        <ul className="thresholds">
          <li><span className="badge allow">ALLOW</span> 0–39 — no strong scam signals</li>
          <li><span className="badge warn">WARN</span> 40–74 — verify before paying</li>
          <li><span className="badge block">BLOCK</span> 75–100 — strong scam indicators</li>
        </ul>
      </div>

      {loading && <p role="status">Loading risk signals…</p>}
      {error && (
        <div role="alert" className="error-card">
          <p>Could not load risk signals: {error}</p>
          <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loading && !error && data && (
        <>
          <div className="card">
            <h2>Decision distribution</h2>
            {total === 0 ? (
              <p className="empty">No evaluations yet — distribution will appear after live evaluations are recorded.</p>
            ) : (
              <div className="distribution">
                {(["ALLOW", "WARN", "BLOCK"] as const).map((d) => (
                  <div key={d} className="dist-row">
                    <span className={`badge ${d.toLowerCase()}`}>{d}</span>
                    <div className="bar" role="img" aria-label={`${d}: ${data.distribution[d]}`}>
                      <div className={`bar-fill ${d.toLowerCase()}`} style={{ width: `${(data.distribution[d] / total) * 100}%` }} />
                    </div>
                    <span className="dist-count">{data.distribution[d]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h2>Flagged VPAs</h2>
            {data.flagged_vpas.length === 0 ? (
              <p className="empty">No VPAs flagged yet.</p>
            ) : (
              <ul>
                {data.flagged_vpas.map((v) => (
                  <li key={v}><code>{v}</code></li>
                ))}
              </ul>
            )}
            <p className="hint">Signals are evaluated locally from the payment context you provide. No external reputation feed is configured.</p>
          </div>
        </>
      )}
    </section>
  );
}