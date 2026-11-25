import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail/mailgun";
import { invoiceEmail, welcomeEmail } from "@/lib/mail/templates";
import { log } from "@/lib/log";
import { COUNTRY_CODES } from "@/lib/checkout/geo";

/** Course ids included in an order (bundle courses, or the single course). */
export async function orderCourseIds(order: { offer_id: string | null; course_id: string | null }): Promise<string[]> {
  if (order.course_id) return [order.course_id];
  const { data } = await supabaseAdmin().from("offer_courses").select("course_id").eq("offer_id", order.offer_id!);
  return (data ?? []).map((r) => r.course_id);
}

/** Finds or creates the auth user for an email. Profile row is created by DB trigger. */
async function ensureCustomer(email: string, fullName: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: existing } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) {
    const { data: again } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (again) return again.id;
    throw new Error(`create customer failed: ${error?.message}`);
  }
  await db.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
  return data.user.id;
}

/** Builds a one-time login URL that lands on our /auth/confirm route (SSR-safe). */
export async function magicLinkUrl(email: string, next: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`generate link failed: ${error?.message}`);
  const u = new URL("/auth/confirm/", env.siteUrl());
  u.searchParams.set("token_hash", data.properties.hashed_token);
  u.searchParams.set("type", "email");
  u.searchParams.set("next", next);
  return u.toString();
}

/**
 * Idempotent: grants access on every call (upsert), but sends emails only the
 * first time (guarded by an atomic fulfilled_at claim).
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.status !== "approved") return;

  const userId = order.user_id ?? (await ensureCustomer(order.email, `${order.first_name} ${order.last_name}`));
  if (!order.user_id) await db.from("orders").update({ user_id: userId }).eq("id", order.id);

  const courseIds = await orderCourseIds(order);
  if (courseIds.length) {
    const { error } = await db
      .from("course_access")
      .upsert(courseIds.map((course_id) => ({ user_id: userId, course_id, order_id: order.id, revoked_at: null })), {
        onConflict: "user_id,course_id,order_id",
      });
    if (error) throw new Error(`grant access failed: ${error.message}`);
  }

  // Claim the one-time email step.
  const { data: claimed } = await db
    .from("orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("fulfilled_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: courses } = await db.from("courses").select("title").in("id", courseIds);
  const titles = (courses ?? []).map((c) => c.title);
  const { data: txn } = await db
    .from("transactions")
    .select("trans_id, card_last4")
    .eq("order_id", order.id)
    .eq("response_code", 1)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const countryName = COUNTRY_CODES.includes(order.country)
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(order.country) ?? order.country
    : order.country;

  await sendMail(
    invoiceEmail({
      invoiceNumber: order.invoice_number,
      date: new Date(order.created_at),
      itemName: order.item_name,
      courses: titles,
      amountCents: order.amount_cents,
      cardLast4: txn?.card_last4,
      transId: txn?.trans_id ?? "",
      billTo: { firstName: order.first_name, lastName: order.last_name, address: order.address, city: order.city, state: order.state, zip: order.zip, country: countryName },
      email: order.email,
    }),
  );
  try {
    const url = await magicLinkUrl(order.email, "/my-account/");
    await sendMail(welcomeEmail(order.email, order.first_name, url, titles));
  } catch (e) {
    log.error("welcome email failed", { orderId: order.id, error: (e as Error).message });
  }
}

export async function revokeAccess(orderId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("course_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .is("revoked_at", null);
  if (error) throw new Error(`revoke access failed: ${error.message}`);
}
