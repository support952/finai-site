import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the X-ANET-Signature header: "sha512=<HEX>" where HEX is the
 * HMAC-SHA512 of the raw request body keyed with the merchant Signature Key.
 * Comparison is case-insensitive and constant-time.
 */
export function computeAnetSignature(rawBody: string, signatureKey: string): string {
  return createHmac("sha512", signatureKey).update(rawBody, "utf8").digest("hex").toUpperCase();
}

export function verifyAnetSignature(rawBody: string, header: string | null | undefined, signatureKey: string): boolean {
  if (!header || !signatureKey) return false;
  const m = /^sha512=([0-9a-fA-F]{128})$/.exec(header.trim());
  if (!m) return false;
  const expected = Buffer.from(computeAnetSignature(rawBody, signatureKey), "utf8");
  const given = Buffer.from(m[1].toUpperCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
