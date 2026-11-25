import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AnetTransactionDetails } from "@/lib/authnet/client";
import { last4, mergeStatus, paymentStatus, toCents, type OrderStatus } from "./status";
import { fulfillOrder, revokeAccess } from "./fulfill";
import { log } from "@/lib/log";

export interface RecordResult {
  orderId: string | null;
  publicId: string | null;
  status: OrderStatus | null;
  note?: string;
}

/**
 * Stores a transaction exactly as Authorize.Net reports it (from
 * getTransactionDetailsRequest — never from client-supplied data) and moves
 * the order forward. Safe to call any number of times for the same transId.
 */
export async function recordTransaction(d: AnetTransactionDetails): Promise<RecordResult> {
  const db = supabaseAdmin();
  const type = d.transactionType ?? "";

  // Refunds / voids reference the original transaction.
  if (type === "refundTransaction" || type === "voidTransaction") {
    const { data: orig } = await db.from("transactions").select("order_id").eq("trans_id", d.refTransId ?? "").maybeSingle();
    if (!orig) return { orderId: null, publicId: null, status: null, note: "refund/void for unknown transaction" };
    await upsertTxn(d, orig.order_id);
    if (d.responseCode === 1) {
      const target: OrderStatus = type === "refundTransaction" ? "refunded" : "voided";
      return setOrderStatus(orig.order_id, target);
    }
    return statusOf(orig.order_id);
  }
  if (type && type !== "authCaptureTransaction" && type !== "priorAuthCaptureTransaction") {
    return { orderId: null, publicId: null, status: null, note: `ignored transaction type ${type}` };
  }

  // A void of the original transaction shows up as transactionStatus=voided.
  const invoice = d.order?.invoiceNumber;
  if (!invoice) return { orderId: null, publicId: null, status: null, note: "no invoice number" };
  const { data: order } = await db
    .from("orders")
    .select("id, public_id, status, amount_cents, email")
    .eq("invoice_number", invoice)
    .maybeSingle();
  if (!order) return { orderId: null, publicId: null, status: null, note: "unknown invoice" };

  await upsertTxn(d, order.id);

  let incoming = paymentStatus(d);
  // Tamper check: the charged amount must equal the order (= offer) price.
  const charged = toCents(d.authAmount ?? d.settleAmount);
  if (incoming === "approved" && charged !== order.amount_cents) {
    log.error("amount mismatch — not fulfilling", { orderId: order.id, transId: d.transId, charged, expected: order.amount_cents });
    incoming = "error";
  }

  if (incoming === "declined") await registerDecline(d, order.email);

  const result = await setOrderStatus(order.id, mergeStatus(order.status as OrderStatus, incoming));
  return result;
}

async function upsertTxn(d: AnetTransactionDetails, orderId: string) {
  const db = supabaseAdmin();
  const row = {
    order_id: orderId,
    trans_id: d.transId,
    ref_trans_id: d.refTransId ?? null,
    transaction_type: d.transactionType ?? null,
    transaction_status: d.transactionStatus ?? null,
    response_code: d.responseCode ?? null,
    response_reason_code: d.responseReasonCode ?? null,
    response_reason: d.responseReasonDescription ?? null,
    auth_code: d.authCode ?? null,
    avs_result_code: d.AVSResponse ?? null,
    cvv_result_code: d.cardCodeResponse ?? null,
    card_last4: last4(d.payment?.creditCard?.cardNumber),
    card_type: d.payment?.creditCard?.cardType ?? null,
    amount_cents: toCents(d.authAmount ?? d.settleAmount),
    bill_to: d.billTo ?? null,
    customer_ip: d.customerIP ?? null,
    submitted_at: d.submitTimeUTC ?? null,
  };
  const { error } = await db.from("transactions").upsert(row, { onConflict: "trans_id" });
  if (error) throw new Error(`store transaction failed: ${error.message}`);
}

async function registerDecline(d: AnetTransactionDetails, email: string) {
  const db = supabaseAdmin();
  const l4 = last4(d.payment?.creditCard?.cardNumber);
  if (!l4) return;
  await db.from("decline_attempts").upsert({ card_last4: l4, email: email.toLowerCase(), trans_id: d.transId }, { onConflict: "trans_id", ignoreDuplicates: true });
  // Count declines in the last 24h, but only those after the most recent
  // admin release for this card+email (so a release gives a fresh start).
  const { data: lastRelease } = await db
    .from("card_blocks")
    .select("released_at")
    .eq("card_last4", l4)
    .eq("email", email.toLowerCase())
    .not("released_at", "is", null)
    .order("released_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const since = new Date(Math.max(dayAgo, lastRelease?.released_at ? Date.parse(lastRelease.released_at) : 0)).toISOString();
  const { count } = await db
    .from("decline_attempts")
    .select("id", { count: "exact", head: true })
    .eq("card_last4", l4)
    .eq("email", email.toLowerCase())
    .gte("created_at", since);
  if ((count ?? 0) >= 2) {
    const { data: existing } = await db.from("card_blocks").select("id").eq("card_last4", l4).eq("email", email.toLowerCase()).is("released_at", null).maybeSingle();
    if (!existing) {
      const { error } = await db.from("card_blocks").insert({ card_last4: l4, email: email.toLowerCase() });
      if (error && !error.message.includes("duplicate")) log.error("card block insert failed", { error: error.message });
      else log.warn("card blocked after repeated declines", { last4: l4 });
    }
  }
}

async function statusOf(orderId: string): Promise<RecordResult> {
  const { data } = await supabaseAdmin().from("orders").select("id, public_id, status").eq("id", orderId).single();
  return { orderId: data?.id ?? orderId, publicId: data?.public_id ?? null, status: (data?.status as OrderStatus) ?? null };
}

/** Applies a status, syncs the affiliate view and runs fulfillment / revocation. */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<RecordResult> {
  const db = supabaseAdmin();
  const { data: order, error } = await db
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id, public_id, status, affiliate_id, payment_link_id, offer_id, item_name, amount_cents, email, phone, created_at")
    .single();
  if (error || !order) throw new Error(`update order failed: ${error?.message}`);

  if (order.affiliate_id) {
    const { data: txn } = await db
      .from("transactions")
      .select("card_last4")
      .eq("order_id", order.id)
      .not("card_last4", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await db.from("affiliate_sales").upsert(
      {
        order_id: order.id,
        affiliate_id: order.affiliate_id,
        payment_link_id: order.payment_link_id,
        offer_id: order.offer_id,
        offer_name: order.item_name,
        amount_cents: order.amount_cents,
        status: order.status,
        card_last4: txn?.card_last4 ?? null,
        customer_email: order.email,
        customer_phone: order.phone,
        created_at: order.created_at,
      },
      { onConflict: "order_id" },
    );
  }

  if (status === "approved") await fulfillOrder(order.id);
  if (status === "refunded" || status === "voided" || status === "chargeback") await revokeAccess(order.id);

  return { orderId: order.id, publicId: order.public_id, status: order.status as OrderStatus };
}
