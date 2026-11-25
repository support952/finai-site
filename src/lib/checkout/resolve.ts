import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyLink } from "@/lib/links";
import { env } from "@/lib/env";

export interface ResolvedItem {
  kind: "offer" | "course";
  offerId: string | null;
  courseId: string | null;
  itemId: string; // slug, used as Authorize.Net lineItem itemId
  name: string;
  description: string;
  courseTitles: string[];
  amountCents: number;
  affiliateId: string | null;
  paymentLinkId: string | null;
}

export type ItemRef = { type: "offer"; slug: string } | { type: "course"; slug: string } | { type: "link"; token: string };

/**
 * Resolves what is being bought and its price — ALWAYS from the database,
 * never from client input. Returns null if the item cannot be sold.
 */
export async function resolveItem(ref: ItemRef): Promise<ResolvedItem | null> {
  const db = supabaseAdmin();

  if (ref.type === "course") {
    const { data: c } = await db.from("courses").select("id, slug, title, short_description, price_cents, is_visible").eq("slug", ref.slug).maybeSingle();
    if (!c || !c.is_visible || !c.price_cents) return null;
    return {
      kind: "course", offerId: null, courseId: c.id, itemId: c.slug, name: c.title,
      description: c.title, courseTitles: [c.title], amountCents: c.price_cents, affiliateId: null, paymentLinkId: null,
    };
  }

  let offerQuery = db.from("offers").select("id, slug, name, price_cents, visibility, is_active, offer_courses(course:courses(title, sort_order))");
  let affiliateId: string | null = null;
  let paymentLinkId: string | null = null;

  if (ref.type === "link") {
    const p = verifyLink(ref.token, env.linkSigningSecret());
    if (!p) return null;
    const { data: link } = await db.from("payment_links").select("id, affiliate_id, offer_id, is_revoked").eq("id", p.l).maybeSingle();
    if (!link || link.is_revoked || link.affiliate_id !== p.a || link.offer_id !== p.o) return null;
    const { data: aff } = await db.from("affiliates").select("id, is_active").eq("id", p.a).maybeSingle();
    if (!aff?.is_active) return null;
    const { data: allowed } = await db.from("affiliate_offers").select("offer_id").eq("affiliate_id", p.a).eq("offer_id", p.o).maybeSingle();
    if (!allowed) return null;
    affiliateId = p.a;
    paymentLinkId = link.id;
    offerQuery = offerQuery.eq("id", p.o);
  } else {
    offerQuery = offerQuery.eq("slug", ref.slug).eq("visibility", "public");
  }

  const { data: o } = await offerQuery.maybeSingle();
  if (!o || !o.is_active) return null;
  const titles = ((o as any).offer_courses ?? [])
    .map((oc: any) => oc.course)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((c: any) => c.title as string);
  if (!titles.length) return null;
  return {
    kind: "offer", offerId: o.id, courseId: null, itemId: o.slug, name: `${o.name} bundle`,
    description: `${o.name} bundle — ${titles.length} courses: ${titles.join(", ")}`,
    courseTitles: titles, amountCents: o.price_cents, affiliateId, paymentLinkId,
  };
}
