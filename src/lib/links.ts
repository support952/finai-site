import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed affiliate payment links.
 *
 * token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadPart, secret))
 *
 * The payload carries ONLY identifiers (affiliate, offer, link). The price is
 * never in the link — it is always read from the offer in the database — so
 * neither price nor attribution can be changed without invalidating the HMAC.
 */
export interface LinkPayload {
  v: 1;
  a: string; // affiliate id
  o: string; // offer id
  l: string; // payment_links.id
  iat: number; // issued at (unix seconds)
}

const b64url = (b: Buffer) => b.toString("base64url");

function hmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data, "utf8").digest();
}

export function signLink(p: Omit<LinkPayload, "v" | "iat"> & { iat?: number }, secret: string): string {
  if (!secret || secret.length < 32) throw new Error("link signing secret too short");
  const payload: LinkPayload = { v: 1, a: p.a, o: p.o, l: p.l, iat: p.iat ?? Math.floor(Date.now() / 1000) };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${b64url(hmac(body, secret))}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the payload if the token is authentic, otherwise null. */
export function verifyLink(token: string, secret: string): LinkPayload | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  const expected = hmac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LinkPayload;
    if (p.v !== 1 || !UUID.test(p.a) || !UUID.test(p.o) || !UUID.test(p.l) || typeof p.iat !== "number") return null;
    return p;
  } catch {
    return null;
  }
}
