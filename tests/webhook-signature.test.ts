import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { computeAnetSignature, verifyAnetSignature } from "@/lib/authnet/webhook-signature";

// Random per run — no key-shaped value is stored in the repo.
const KEY = randomBytes(64).toString("hex").toUpperCase();
const body = JSON.stringify({ notificationId: "n-1", eventType: "net.authorize.payment.authcapture.created", payload: { id: "60000000001", entityName: "transaction" } });
const sig = (b: string, k = KEY) => "sha512=" + createHmac("sha512", k).update(b).digest("hex").toUpperCase();

describe("X-ANET-Signature verification", () => {
  it("accepts a correct HMAC-SHA512 signature", () => {
    expect(computeAnetSignature(body, KEY)).toBe(sig(body).slice(7));
    expect(verifyAnetSignature(body, sig(body), KEY)).toBe(true);
  });
  it("is case-insensitive on the hex digest", () => {
    expect(verifyAnetSignature(body, sig(body).toLowerCase().replace("sha512=", "sha512="), KEY)).toBe(true);
  });
  it("rejects a modified body", () => {
    expect(verifyAnetSignature(body.replace("60000000001", "60000000002"), sig(body), KEY)).toBe(false);
  });
  it("rejects a wrong key", () => {
    expect(verifyAnetSignature(body, sig(body, "other"), KEY)).toBe(false);
  });
  it("rejects missing / malformed headers", () => {
    for (const h of [null, undefined, "", "sha512=", "sha256=" + "A".repeat(128), "A".repeat(128), "sha512=ZZ"]) {
      expect(verifyAnetSignature(body, h as any, KEY)).toBe(false);
    }
  });
  it("rejects when no key is configured", () => {
    expect(verifyAnetSignature(body, sig(body), "")).toBe(false);
  });
});

// --- Route-level: an unsigned/forged webhook never reaches the database or Authorize.Net
const dbCalls: string[] = [];
vi.mock("@/lib/env", () => ({ env: { authnetSignatureKey: () => KEY } }));
vi.mock("@/lib/request", () => ({ clientIp: async () => "203.0.113.1", rateLimit: async () => true }));
vi.mock("@/lib/authnet/client", () => ({ getTransactionDetails: vi.fn(async () => { dbCalls.push("anet"); throw new Error("not in test"); }) }));
vi.mock("@/lib/payments/record", () => ({ recordTransaction: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    const chain: any = new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : (..._a: unknown[]) => { dbCalls.push(String(prop)); return chain; }) });
    return chain;
  },
}));

describe("webhook route", () => {
  beforeEach(() => { dbCalls.length = 0; });
  it("returns 401 and touches nothing when the signature is wrong", async () => {
    const { POST } = await import("@/app/api/webhooks/authorize-net/route");
    const res = await POST(new Request("http://x/api/webhooks/authorize-net", { method: "POST", body, headers: { "x-anet-signature": sig(body, "forged") } }));
    expect(res.status).toBe(401);
    expect(dbCalls).toEqual([]);
  });
  it("returns 401 when the header is missing", async () => {
    const { POST } = await import("@/app/api/webhooks/authorize-net/route");
    const res = await POST(new Request("http://x/api/webhooks/authorize-net", { method: "POST", body }));
    expect(res.status).toBe(401);
    expect(dbCalls).toEqual([]);
  });
});
