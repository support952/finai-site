import { requireAffiliate } from "@/lib/auth";
import { usd } from "@/lib/money";
import { parsePeriod } from "@/lib/period";
import { CopyButton } from "@/components/CopyButton";
import { generatePaymentLink } from "../actions";

/**
 * Everything here is read with the affiliate's own session: RLS limits every
 * query to this affiliate's rows (see supabase/migrations + tests/rls.test.ts).
 * There is intentionally no export/download.
 */
export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAffiliate();
  const period = parsePeriod(sp);
  const [{ data: offers }, { data: links }, { data: sales }] = await Promise.all([
    supabase.from("affiliate_offers").select("offer:offers(id, name, price_cents, is_active, offer_courses(count))"),
    supabase.from("payment_links").select("id, label, url, is_revoked, created_at, offer_id").order("created_at", { ascending: false }).limit(200),
    supabase.from("affiliate_sales").select("order_id, created_at, offer_name, amount_cents, status, card_last4, customer_email, customer_phone")
      .gte("created_at", period.from.toISOString()).lt("created_at", period.toExclusive.toISOString()).order("created_at", { ascending: false }).limit(1000),
  ]);
  const offerList = (offers ?? []).map((r: any) => r.offer).filter((o: any) => o?.is_active);
  const offerName = new Map(offerList.map((o: any) => [o.id, o.name]));
  const revenue = (sales ?? []).filter((s) => s.status === "approved").reduce((s, r) => s + r.amount_cents, 0);
  const approvedCount = (sales ?? []).filter((s) => s.status === "approved").length;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Overview</h1>
        <form className="card mt-4 flex flex-wrap items-end gap-3 text-sm">
          <div><label className="label">From</label><input type="date" name="from" defaultValue={period.fromStr} className="input" /></div>
          <div><label className="label">To</label><input type="date" name="to" defaultValue={period.toStr} className="input" /></div>
          <button className="btn-primary">Apply</button>
          <div className="ml-auto text-right"><p className="text-slate-500">Revenue (approved) in period</p><p className="text-2xl font-bold">{usd(revenue)}</p><p className="text-xs text-slate-500">{approvedCount} approved sales</p></div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Create a payment link</h2>
        {offerList.length === 0 ? <p className="mt-2 text-sm text-slate-600">No offers are assigned to you yet.</p> : (
          <form action={generatePaymentLink} className="card mt-3 flex flex-wrap items-end gap-3 text-sm">
            <div><label className="label">Offer</label>
              <select name="offer_id" className="input" required>{offerList.map((o: any) => <option key={o.id} value={o.id}>{o.name} — {usd(o.price_cents)} ({o.offer_courses?.[0]?.count ?? 0} courses)</option>)}</select></div>
            <div className="flex-1"><label className="label">Label (optional, only you see it)</label><input name="label" maxLength={100} className="input" placeholder="e.g. John Smith call 11/25" /></div>
            <button className="btn-primary">Generate link</button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">My links</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table bg-white">
            <thead><tr><th>Created</th><th>Offer</th><th>Label</th><th>Link</th><th>Status</th></tr></thead>
            <tbody>
              {(links ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-US")}</td>
                  <td>{offerName.get(l.offer_id) ?? "—"}</td><td>{l.label ?? "—"}</td>
                  <td className="max-w-xs truncate text-xs">{l.is_revoked ? <span className="text-slate-400 line-through">{l.url}</span> : <><span className="mr-2">{l.url.slice(0, 48)}…</span><CopyButton text={l.url} /></>}</td>
                  <td>{l.is_revoked ? "Revoked" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">My transactions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table bg-white">
            <thead><tr><th>Date</th><th>Offer</th><th>Amount</th><th>Status</th><th>Card</th><th>Customer email</th><th>Customer phone</th></tr></thead>
            <tbody>
              {(sales ?? []).map((s) => (
                <tr key={s.order_id}>
                  <td className="whitespace-nowrap">{new Date(s.created_at).toLocaleString("en-US")}</td>
                  <td>{s.offer_name}</td><td>{usd(s.amount_cents)}</td><td>{s.status}</td>
                  <td>{s.card_last4 ? `•••• ${s.card_last4}` : "—"}</td><td>{s.customer_email}</td><td>{s.customer_phone}</td>
                </tr>
              ))}
              {(sales ?? []).length === 0 ? <tr><td colSpan={7} className="text-slate-500">No transactions in this period.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
