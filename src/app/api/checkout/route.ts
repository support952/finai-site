import { NextResponse } from "next/server";
import { checkoutRequestSchema, fieldErrors } from "@/lib/checkout/schema";
import { resolveItem } from "@/lib/checkout/resolve";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/request";
import { newInvoiceNumber } from "@/lib/invoice";
import { buildHostedPaymentPageRequest, toAnetCustomerIp } from "@/lib/authnet/hosted";
import { anetEndpoints, anetRequest, merchantAuth } from "@/lib/authnet/client";
import { env } from "@/lib/env";
import { site } from "@/config/site";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Creates a pending order and an Accept Hosted token for it.
 * Card data is entered only inside Authorize.Net's iframe.
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await rateLimit(`checkout:${ip}`, 10, 600))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please correct the highlighted fields.", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const { customer, item: ref } = parsed.data;

  const item = await resolveItem(ref);
  if (!item) return NextResponse.json({ error: "This offer is not available." }, { status: 404 });

  const db = supabaseAdmin();

  // Card blocks: the card number is entered in Authorize.Net's iframe, so we
  // can't know last4 before payment. A block (last4+email) therefore stops new
  // checkouts for that email until an admin releases it.
  const { data: block } = await db.from("card_blocks").select("id").eq("email", customer.email).is("released_at", null).limit(1).maybeSingle();
  if (block) {
    return NextResponse.json(
      { error: `For your security, payments for this email are paused after repeated declines. Please contact ${site.supportEmail}.` },
      { status: 403 },
    );
  }

  let order: { id: string; public_id: string; invoice_number: string } | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const { data, error } = await db
      .from("orders")
      .insert({
        invoice_number: newInvoiceNumber(),
        offer_id: item.offerId,
        course_id: item.courseId,
        item_name: item.name,
        amount_cents: item.amountCents,
        affiliate_id: item.affiliateId,
        payment_link_id: item.paymentLinkId,
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        country: customer.country,
        customer_ip: ip,
      })
      .select("id, public_id, invoice_number")
      .single();
    if (!error) order = data;
    else if (!error.message.includes("duplicate")) {
      log.error("create order failed", { error: error.message });
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
    }
  }
  if (!order) return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });

  if (item.affiliateId) {
    await db.from("affiliate_sales").insert({
      order_id: order.id, affiliate_id: item.affiliateId, payment_link_id: item.paymentLinkId, offer_id: item.offerId,
      offer_name: item.name, amount_cents: item.amountCents, status: "pending",
      customer_email: customer.email, customer_phone: customer.phone, created_at: new Date().toISOString(),
    });
  }

  const siteUrl = env.siteUrl();
  try {
    const request = buildHostedPaymentPageRequest({
      merchant: merchantAuth(),
      refId: order.invoice_number.replace(/-/g, ""),
      amountCents: item.amountCents,
      invoiceNumber: order.invoice_number,
      description: item.description,
      lineItem: { itemId: item.itemId, name: item.name, description: item.description },
      customer,
      customerIP: toAnetCustomerIp(ip),
      merchantName: site.cardDescriptor,
      returnUrl: `${siteUrl}/checkout/result/${order.public_id}/`,
      cancelUrl: `${siteUrl}/checkout/result/${order.public_id}/?cancelled=1`,
      iframeCommunicatorUrl: `${siteUrl}/anet/iframe-communicator.html`,
    });
    const res = await anetRequest<{ token: string }>(request);
    return NextResponse.json({ token: res.token, formUrl: anetEndpoints().paymentForm, publicId: order.public_id });
  } catch (e) {
    log.error("getHostedPaymentPage failed", { orderId: order.id, error: (e as Error).message });
    await db.from("orders").update({ status: "error" }).eq("id", order.id);
    return NextResponse.json({ error: "The payment service is unavailable. Please try again shortly." }, { status: 502 });
  }
}
