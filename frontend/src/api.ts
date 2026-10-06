export type Decision = "ALLOW" | "WARN" | "BLOCK";

export interface Factor {
  code: string;
  label: string;
  weight: number;
  detail: string;
}

export interface EvaluateResponse {
  transaction_id: string;
  timestamp: string;
  amount: number;
  vpa: string;
  decision: Decision;
  risk_score: number;
  advisory: string;
  intent_label: string;
  intent_matches: string[];
  factors: Factor[];
}

export interface AuditLog {
  transaction_id: string;
  timestamp: string;
  amount: number;
  vpa: string;
  note: string | null;
  is_active_call: boolean;
  is_first_time_payee: boolean;
  decision: Decision;
  risk_score: number;
  advisory: string;
  intent_label: string;
}

export interface DashboardSummary {
  total_evaluations: number;
  allow_count: number;
  warn_count: number;
  block_count: number;
  flagged_vpa_count: number;
  recent_blocked: AuditLog[];
}

export interface RiskSignals {
  thresholds: Record<string, string>;
  distribution: Record<Decision, number>;
  flagged_vpas: string[];
}

export interface EvaluateRequest {
  amount: number;
  vpa: string;
  note?: string;
  payee_name?: string;
  is_active_call: boolean;
  is_first_time_payee: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  evaluate: (payload: EvaluateRequest) =>
    request<EvaluateResponse>("/api/v1/evaluate-transaction", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  auditLogs: (limit = 20) => request<AuditLog[]>(`/api/v1/audit-logs?limit=${limit}`),
  summary: () => request<DashboardSummary>("/api/v1/dashboard-summary"),
  riskSignals: () => request<RiskSignals>("/api/v1/risk-signals"),
};
