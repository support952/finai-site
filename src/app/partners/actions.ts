"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAffiliate } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signLink } from "@/lib/links";
import { env } from "@/lib/env";

/** Creates a signed payment link for an offer this affiliate is allowed to sell. */
export async function generatePaymentLink(formData: FormData) {
  const { supabase, affiliate } = await requireAffiliate();
  const offerId = z.uuid().parse(formData.get("offer_id"));
  const label = z.string().trim().max(100).optional().parse(formData.get("label") ?? undefined) || null;

  // RLS: this select only returns rows for the signed-in affiliate.
  const { data: allowed } = await supabase.from("affiliate_offers").select("offer_id, offer:offers(is_active)").eq("offer_id", offerId).maybeSingle();
  if (!allowed || !(allowed as any).offer?.is_active) throw new Error("You are not allowed to sell this offer");

  const id = crypto.randomUUID();
  const token = signLink({ a: affiliate.id, o: offerId, l: id }, env.linkSigningSecret());
  const url = `${env.siteUrl()}/pay/${token}/`;
  const { error } = await supabaseAdmin().from("payment_links").insert({ id, affiliate_id: affiliate.id, offer_id: offerId, label, url });
  if (error) throw new Error("Could not create link");
  revalidatePath("/partners/");
}
