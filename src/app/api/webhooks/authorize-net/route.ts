import { NextResponse } from "next/server";
import { verifyAnetSignature } from "@/lib/authnet/webhook-signature";
import { getTransactionDetails } from "@/lib/authnet/client";
import { recordTransaction } from "@/lib/payments/record";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/request";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const PAYMENT_EVENTS = new Set([
  "net.authorize.payment.authcapture.created",
  "net.authorize.payment.capture.created",
  "net.authorize.payment.priorAuthCapture.created",
  "net.authorize.payment.refund.created",
  "net.authorize.payment.void.created",
  "net.authorize.payment.fraud.held",
  "net.authorize.payment.fraud.approved",
  "net.authorize.payment.fraud.declined",
]);

export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await rateLimit(`webhook:${ip}`, 300, 60))) return new NextResponse("rate limited", { status: 429 });

  const raw = await req.text();
  if (raw.length > 64 * 1024) return new NextResponse("too large", { status: 413 });
  if (!verifyAnetSignature(raw, req.headers.get("x-anet-signature"), env.authnetSignatureKey())) {
    log.warn("webhook signature rejected", { ip });
    return new NextResponse("invalid signature", { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const notificationId = String(evt?.notificationId ?? "");
  const eventType = String(evt?.eventType ?? "");
  const entityId = String(evt?.payload?.id ?? "");
  if (!notificationId || !eventType) return new NextResponse("bad payload", { status: 400 });

  const db = supabaseAdmin();
  // Idempotency: one row per notificationId; skip if already processed.
  const { data: existing } = await db.from("webhook_events").select("id, processed_at").eq("notification_id", notificationId).maybeSingle();
  if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  if (!existing) {
    const { error } = await db.from("webhook_events").insert({ notification_id: notificationId, event_type: eventType, entity_id: entityId, payload: evt });
    if (error && !error.message.includes("duplicate")) return new NextResponse("store failed", { status: 500 });
  }

  if (!PAYMENT_EVENTS.has(eventType) || evt?.payload?.entityName !== "transaction" || !/^\d{1,20}$/.test(entityId)) {
    await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("notification_id", notificationId);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    // Never trust the webhook body for amounts/status: confirm with the API.
    const details = await getTransactionDetails(entityId);
    const r = await recordTransaction(details);
    await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: r.note ?? null }).eq("notification_id", notificationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    log.error("webhook processing failed", { notificationId, eventType, error: msg });
    await db.from("webhook_events").update({ error: msg }).eq("notification_id", notificationId);
    return new NextResponse("processing failed", { status: 500 }); // Authorize.Net retries
  }
}
