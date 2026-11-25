/** Pure helpers for deriving order status from Authorize.Net transaction details. */
export type OrderStatus = "pending" | "approved" | "declined" | "error" | "held" | "refunded" | "voided" | "chargeback";

export interface DetailsLike {
  transactionType?: string;
  transactionStatus?: string;
  responseCode?: number;
}

/** Status implied by a payment (authCapture) transaction. */
export function paymentStatus(d: DetailsLike): OrderStatus {
  const ts = d.transactionStatus ?? "";
  if (ts === "voided") return "voided";
  if (ts === "FDSPendingReview" || ts === "FDSAuthorizedPendingReview" || d.responseCode === 4) return "held";
  if (ts === "declined" || d.responseCode === 2) return "declined";
  if (d.responseCode === 1) {
    if (ts === "refundSettledSuccessfully" || ts === "refundPendingSettlement") return "refunded";
    return "approved";
  }
  return "error";
}

const TERMINAL: OrderStatus[] = ["refunded", "voided", "chargeback"];

/**
 * Merge rule: a failed retry never downgrades an approved order; refunds /
 * voids / chargebacks are terminal; a later approval upgrades a decline.
 */
export function mergeStatus(current: OrderStatus, incoming: OrderStatus): OrderStatus {
  if (TERMINAL.includes(current)) return current;
  if (current === "approved") return TERMINAL.includes(incoming) ? incoming : "approved";
  return incoming;
}

export function last4(cardNumber?: string): string | null {
  const m = /(\d{4})$/.exec(cardNumber ?? "");
  return m ? m[1] : null;
}

export function toCents(amount?: number): number | null {
  return typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) : null;
}
