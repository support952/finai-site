import "server-only";
import { env } from "@/lib/env";

export const ANET_ENDPOINTS = {
  sandbox: {
    api: "https://apitest.authorize.net/xml/v1/request.api",
    paymentForm: "https://test.authorize.net/payment/payment",
  },
  production: {
    api: "https://api.authorize.net/xml/v1/request.api",
    paymentForm: "https://accept.authorize.net/payment/payment",
  },
} as const;

export function anetEndpoints() {
  return ANET_ENDPOINTS[env.authnetEnv()];
}

export function merchantAuth() {
  return { name: env.authnetLoginId(), transactionKey: env.authnetTransactionKey() };
}

export class AnetError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** POST a JSON request to the Authorize.Net API. Never logs the request body. */
export async function anetRequest<T = any>(body: unknown): Promise<T> {
  const res = await fetch(anetEndpoints().api, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new AnetError(`Authorize.Net HTTP ${res.status}`);
  // Authorize.Net prefixes JSON responses with a UTF-8 BOM.
  const text = (await res.text()).replace(/^﻿/, "");
  const json = JSON.parse(text);
  const rc = json?.messages?.resultCode;
  if (rc !== "Ok") {
    const m = json?.messages?.message?.[0];
    throw new AnetError(`Authorize.Net error ${m?.code ?? ""}: ${m?.text ?? "unknown"}`, m?.code);
  }
  return json as T;
}

export interface AnetTransactionDetails {
  transId: string;
  refTransId?: string;
  submitTimeUTC?: string;
  transactionType?: string;
  transactionStatus?: string;
  responseCode?: number;
  responseReasonCode?: number;
  responseReasonDescription?: string;
  authCode?: string;
  AVSResponse?: string;
  cardCodeResponse?: string;
  order?: { invoiceNumber?: string; description?: string };
  authAmount?: number;
  settleAmount?: number;
  payment?: { creditCard?: { cardNumber?: string; cardType?: string } };
  customer?: { email?: string };
  billTo?: Record<string, string>;
  customerIP?: string;
}

export async function getTransactionDetails(transId: string): Promise<AnetTransactionDetails> {
  if (!/^\d{1,20}$/.test(transId)) throw new AnetError("invalid transId");
  const json = await anetRequest<{ transaction: AnetTransactionDetails }>({
    getTransactionDetailsRequest: { merchantAuthentication: merchantAuth(), transId },
  });
  return json.transaction;
}
