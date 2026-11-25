import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";
import { resendAffiliateInvite, revokeLink, updateAffiliate } from "../../../actions";

export default async function EditAffiliate({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireRole("admin", "/admin/login/");
  const [{ data: a }, { data: offers }, { data: allowed }, { data: links }] = await Promise.all([
    supabase.from("affiliates").select("*").eq("id", id).maybeSingle(),
    supabase.from("offers").select("id, name, price_cents, visibility, is_active").order("sort_order"),
    supabase.from("affiliate_offers").select("offer_id").eq("affiliate_id", id),
    supabase.from("payment_links").select("id, label, url, is_revoked, created_at, offer:offers(name)").eq("affiliate_id", id).order("created_at", { ascending: false }),
  ]);
  if (!a) notFound();
  const allowedIds = (allowed ?? []).map((r) => r.offer_id);
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">{a.name}</h1>
      {sp.saved ? <p className="rounded bg-green-50 p-3 text-sm text-green-800">Saved.</p> : null}
      {sp.created ? <p className="rounded bg-green-50 p-3 text-sm text-green-800">Affiliate created and invite email sent. Now choose which offers they may sell.</p> : null}
      <form action={updateAffiliate} className="card space-y-4">
        <input type="hidden" name="id" value={a.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Name</label><input name="name" className="input" defaultValue={a.name} required /></div>
          <div><label className="label">Email</label><input className="input" value={a.email} disabled /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={a.is_active} /> Active (disabled affiliates can&apos;t sign in to the panel and their links stop working)</label>
        <fieldset>
          <legend className="label">Offers this affiliate may sell</legend>
          {(offers ?? []).map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="offer_ids" value={o.id} defaultChecked={allowedIds.includes(o.id)} />
              {o.name} — {usd(o.price_cents)} <span className="text-slate-500">({o.visibility === "public" ? "public" : "affiliate-only"}{o.is_active ? "" : ", inactive"})</span>
            </label>
          ))}
        </fieldset>
        <button className="btn-primary">Save</button>
      </form>
      <form action={resendAffiliateInvite.bind(null, a.id)}><button className="btn-secondary">Resend password email</button></form>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment links</h2>
        <table className="table bg-white">
          <thead><tr><th>Created</th><th>Offer</th><th>Label</th><th>Status</th><th /></tr></thead>
          <tbody>
            {(links ?? []).map((l: any) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString("en-US")}</td><td>{l.offer?.name}</td><td>{l.label ?? "—"}</td>
                <td>{l.is_revoked ? "Revoked" : "Active"}</td>
                <td>{l.is_revoked ? null : <form action={revokeLink.bind(null, l.id)}><button className="text-sm text-red-600 underline">Revoke</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
