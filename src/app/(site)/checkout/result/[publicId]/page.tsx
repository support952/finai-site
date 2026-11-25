import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { usd } from "@/lib/money";
import { site } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order status", robots: { index: false } };

/** Shows the STORED order status (from Authorize.Net via webhook/confirm), never query params. */
export default async function ResultPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) notFound();
  const { data: order } = await supabaseAdmin()
    .from("orders")
    .select("status, item_name, amount_cents, first_name, invoice_number, email")
    .eq("public_id", publicId)
    .maybeSingle();
  if (!order) notFound();

  const s = order.status as string;
  const view: Record<string, { title: string; body: string; tone: string }> = {
    approved: { title: `Thank you, ${order.first_name}!`, body: `Your payment of ${usd(order.amount_cents)} for ${order.item_name} was approved. We've emailed your invoice and a sign-in link to ${order.email}.`, tone: "bg-green-50 text-green-800" },
    pending: { title: "Confirming your payment…", body: "This usually takes a few seconds. This page refreshes automatically.", tone: "bg-slate-50 text-slate-800" },
    held: { title: "Payment under review", body: `Your payment is being reviewed. You'll receive an email once it's complete. Questions: ${site.supportEmail}.`, tone: "bg-amber-50 text-amber-800" },
    declined: { title: "Payment declined", body: "Your card was declined. Please check your billing details (name, address and ZIP must match your card) or use another card.", tone: "bg-red-50 text-red-800" },
    error: { title: "Payment not completed", body: `We could not complete your payment. You have not been charged by this attempt. Contact ${site.supportEmail} if this persists.`, tone: "bg-red-50 text-red-800" },
    refunded: { title: "Order refunded", body: "This order has been refunded.", tone: "bg-slate-50 text-slate-800" },
    voided: { title: "Order cancelled", body: "This payment was voided.", tone: "bg-slate-50 text-slate-800" },
    chargeback: { title: "Order disputed", body: `Please contact ${site.supportEmail}.`, tone: "bg-slate-50 text-slate-800" },
  };
  const v = view[s] ?? view.error;
  return (
    <div className="container-page max-w-2xl py-16">
      {s === "pending" ? <meta httpEquiv="refresh" content="4" /> : null}
      <div className={`rounded-lg p-6 ${v.tone}`}>
        <h1 className="text-2xl font-bold">{v.title}</h1>
        <p className="mt-3">{v.body}</p>
        <p className="mt-3 text-sm opacity-80">Order {order.invoice_number}</p>
      </div>
      <div className="mt-6 flex gap-3">
        {s === "approved" ? <Link href="/my-account/" className="btn-primary">Go to my courses</Link> : null}
        {s === "declined" || s === "error" ? <Link href="/pricing/" className="btn-secondary">Try again</Link> : null}
      </div>
    </div>
  );
}
