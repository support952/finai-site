import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTransactionDetails } from "@/lib/authnet/client";
import { recordTransaction } from "@/lib/payments/record";
import { clientIp, rateLimit } from "@/lib/request";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({ publicId: z.uuid(), transId: z.string().regex(/^\d{1,20}$/) });

/**
 * Called by the browser after the Accept Hosted iframe reports a response.
 * The browser only tells us WHICH transaction to look at; everything stored
 * comes from getTransactionDetailsRequest, and the transaction must belong to
 * this order's invoice number. The webhook does the same independently.
 */
export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await rateLimit(`confirm:${ip}`, 30, 600))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: order } = await supabaseAdmin().from("orders").select("id, invoice_number, status").eq("public_id", parsed.data.publicId).maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const details = await getTransactionDetails(parsed.data.transId);
    if (details.order?.invoiceNumber !== order.invoice_number) {
      return NextResponse.json({ error: "Transaction does not match order" }, { status: 400 });
    }
    const r = await recordTransaction(details);
    return NextResponse.json({ status: r.status });
  } catch (e) {
    log.error("confirm failed", { orderId: order.id, error: (e as Error).message });
    // The webhook will still deliver the result; the result page polls stored status.
    return NextResponse.json({ status: order.status }, { status: 202 });
  }
}
