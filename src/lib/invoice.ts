import { randomBytes } from "node:crypto";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. "FA251125-7KQ2M9XD" (17 chars, Authorize.Net max is 20). */
export function newInvoiceNumber(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = randomBytes(8);
  let r = "";
  for (const b of bytes) r += ALPHA[b % ALPHA.length];
  return `FA${d}-${r}`;
}
