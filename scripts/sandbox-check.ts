/**
 * Verifies Authorize.Net SANDBOX credentials without charging anything:
 *  1. authenticateTestRequest
 *  2. getHostedPaymentPageRequest for a dummy order (creates a token only; no transaction)
 * Prints only result codes — never credentials, tokens or request bodies.
 *
 *   npx tsx --env-file=.env.local scripts/sandbox-check.ts
 */
import { buildHostedPaymentPageRequest } from "../src/lib/authnet/hosted";

const API = "https://apitest.authorize.net/xml/v1/request.api";

async function call(body: unknown) {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = JSON.parse((await res.text()).replace(/^﻿/, ""));
  const m = json?.messages;
  return { ok: m?.resultCode === "Ok", code: m?.message?.[0]?.code, text: m?.message?.[0]?.text, hasToken: typeof json?.token === "string" };
}

(async () => {
  if ((process.env.AUTHNET_ENV ?? "sandbox") !== "sandbox") throw new Error("This script only runs against the sandbox (AUTHNET_ENV=sandbox).");
  const merchant = { name: process.env.AUTHNET_API_LOGIN_ID ?? "", transactionKey: process.env.AUTHNET_TRANSACTION_KEY ?? "" };
  if (!merchant.name || !merchant.transactionKey) throw new Error("Set AUTHNET_API_LOGIN_ID and AUTHNET_TRANSACTION_KEY in .env.local");

  const auth = await call({ authenticateTestRequest: { merchantAuthentication: merchant } });
  console.log("authenticateTestRequest:", auth.ok ? "OK" : `FAILED ${auth.code} ${auth.text}`);
  if (!auth.ok) process.exit(1);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const hp = await call(
    buildHostedPaymentPageRequest({
      merchant, refId: "SANDBOXCHECK", amountCents: 100, invoiceNumber: "CHECK-" + Date.now().toString().slice(-8),
      description: "Sandbox credential check (no charge)", lineItem: { itemId: "check", name: "Check", description: "Check" },
      customer: { firstName: "Test", lastName: "Buyer", email: "test@example.com", phone: "4345550100", address: "1 Main St", city: "Louisa", state: "VA", zip: "23093", country: "US" },
      customerIP: "203.0.113.10", merchantName: "FINAI SOLUTIONS",
      returnUrl: `${site}/`, cancelUrl: `${site}/`, iframeCommunicatorUrl: `${site}/anet/iframe-communicator.html`,
    }),
  );
  console.log("getHostedPaymentPageRequest:", hp.ok && hp.hasToken ? "OK (token issued, nothing charged)" : `FAILED ${hp.code} ${hp.text}`);
  process.exit(hp.ok ? 0 : 1);
})().catch((e) => { console.error("Error:", (e as Error).message); process.exit(1); });
