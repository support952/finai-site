/**
 * Minimal logger that redacts anything that looks like a secret or card data.
 * Never pass request bodies sent to Authorize.Net to this logger.
 */
const SECRET_KEYS = /(transactionkey|transaction_key|signature|secret|password|token|apikey|api_key|authorization|cardnumber|cardcode|cvv|expiration)/i;

function redact(v: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof v === "string") return v.replace(/\b\d{13,19}\b/g, "[redacted-pan]");
  if (Array.isArray(v)) return v.map((x) => redact(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(val, depth + 1);
    return out;
  }
  return v;
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ level: "info", msg, ...(redact(meta ?? {}) as object) })),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ level: "warn", msg, ...(redact(meta ?? {}) as object) })),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ level: "error", msg, ...(redact(meta ?? {}) as object) })),
};
export { redact };
