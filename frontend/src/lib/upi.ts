export interface UpiPayment {
  vpa: string;
  payeeName: string | null;
  amount: number | null;
  currency: string;
  note: string | null;
  reference: string | null;
}

const VPA_RE = /^[\w.\-]{2,}@[a-zA-Z][\w.\-]{1,}$/;

/**
 * Parse a standard UPI payment link: upi://pay?pa=...&am=...&cu=INR&tn=...
 * Throws Error with a clear message on malformed or unsupported payloads.
 */
export function parseUpiLink(raw: string): UpiPayment {
  const text = raw.trim();
  if (!/^upi:\/\/pay\?/i.test(text)) {
    throw new Error("Unsupported QR code: this is not a UPI payment link.");
  }
  let params: URLSearchParams;
  try {
    params = new URL(text).searchParams;
  } catch {
    throw new Error("Malformed UPI link: could not parse the query string.");
  }
  const pa = params.get("pa");
  if (!pa || !VPA_RE.test(pa)) {
    throw new Error("Malformed UPI link: missing or invalid payee VPA (pa).");
  }
  const cu = (params.get("cu") ?? "INR").toUpperCase();
  if (cu !== "INR") {
    throw new Error(`Unsupported UPI currency '${cu}'. Only INR is supported.`);
  }
  const amRaw = params.get("am");
  let amount: number | null = null;
  if (amRaw !== null && amRaw.trim() !== "") {
    const parsed = Number(amRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Malformed UPI link: invalid amount (am).");
    }
    amount = parsed;
  }
  return {
    vpa: pa,
    payeeName: params.get("pn"),
    amount,
    currency: cu,
    note: params.get("tn"),
    reference: params.get("tr") ?? params.get("tid"),
  };
}

/** Returns true if the raw text looks like a UPI payment link. */
export function isUpiLink(raw: string): boolean {
  return /^upi:\/\/pay\?/i.test(raw.trim());
}
