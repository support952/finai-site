/** AVS and CVV result code references (Authorize.Net). */
export const AVS_CODES: Record<string, { meaning: string; match: "full" | "partial" | "none" | "n/a" }> = {
  A: { meaning: "Street address matches, ZIP does not", match: "partial" },
  B: { meaning: "Address information not provided for AVS check", match: "n/a" },
  E: { meaning: "AVS error", match: "n/a" },
  G: { meaning: "Non-U.S. card issuing bank (AVS not supported)", match: "n/a" },
  N: { meaning: "No match on street address or ZIP", match: "none" },
  P: { meaning: "AVS not applicable for this transaction", match: "n/a" },
  R: { meaning: "Retry — system unavailable or timed out", match: "n/a" },
  S: { meaning: "AVS not supported by card issuing bank", match: "n/a" },
  U: { meaning: "Address information unavailable", match: "n/a" },
  W: { meaning: "Nine-digit ZIP matches, street address does not", match: "partial" },
  X: { meaning: "Street address and nine-digit ZIP match", match: "full" },
  Y: { meaning: "Street address and five-digit ZIP match", match: "full" },
  Z: { meaning: "Five-digit ZIP matches, street address does not", match: "partial" },
};

export const CVV_CODES: Record<string, string> = {
  M: "CVV matched",
  N: "CVV did not match",
  P: "CVV not processed",
  S: "CVV should be on card but was not indicated",
  U: "Issuer not certified / did not provide encryption key",
};

export function avsLabel(code?: string | null): string {
  if (!code) return "—";
  return AVS_CODES[code] ? `${code} — ${AVS_CODES[code].meaning}` : code;
}
export function cvvLabel(code?: string | null): string {
  if (!code) return "—";
  return CVV_CODES[code] ? `${code} — ${CVV_CODES[code]}` : code;
}
