import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";
import { avsLabel, cvvLabel, AVS_CODES } from "@/lib/authnet/codes";
import { parsePeriod } from "@/lib/period";
import { markOrder } from "../../actions";

export const dynamic = "force-dynamic";
const STATUSES = ["pending", "approved", "declined", "error", "held", "refunded", "voided", "chargeback"];

function addrDiff(order: any, billTo: any): string[] {
  if (!billTo) return [];
  const pairs: [string, string, string][] = [
    ["firstName", order.first_name, billTo.firstName], ["lastName", order.last_name, billTo.lastName],
    ["address", order.address, billTo.address], ["city", order.city, billTo.city], ["state", order.state, billTo.state],
    ["zip", order.zip, billTo.zip], ["country", order.country, billTo.country],
  ];
  return pairs.filter(([, a, b]) => (a ?? "").trim().toLowerCase() !== (b ?? "").trim().toLowerCase()).map(([k]) => k);
}

export default async function AdminTransactions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireRole("admin", "/admin/login/");
  const period = parsePeriod(sp);
  let q = supabase
    .from("orders")
    .select("id, created_at, invoice_number, item_name, amount_cents, status, email, phone, first_name, last_name, address, city, state, zip, country, customer_ip, affiliate:affiliates(name), transactions(trans_id, transaction_type, response_code, response_reason, avs_result_code, cvv_result_code, card_last4, card_type, bill_to, created_at)")
    .gte("created_at", period.from.toISOString())
    .lt("created_at", period.toExclusive.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (sp.status && STATUSES.includes(sp.status)) q = q.eq("status", sp.status);
  if (sp.offer) q = q.eq("offer_id", sp.offer);
  if (sp.affiliate === "direct") q = q.is("affiliate_id", null);
  else if (sp.affiliate) q = q.eq("affiliate_id", sp.affiliate);
  const [{ data: orders }, { data: affs }, { data: offers }] = await Promise.all([
    q,
    supabase.from("affiliates").select("id, name").order("name"),
    supabase.from("offers").select("id, name").order("sort_order"),
  ]);
  const avsDist: Record<string, number> = {};
  for (const o of orders ?? []) for (const t of (o as any).transactions ?? []) if (t.avs_result_code) avsDist[t.avs_result_code] = (avsDist[t.avs_result_code] ?? 0) + 1;

  return (
    <div>
      <h1 className="text-2xl font-bold">Transactions</h1>
      <form className="card mt-4 flex flex-wrap items-end gap-3 text-sm">
        <div><label className="label">From</label><input type="date" name="from" defaultValue={period.fromStr} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={period.toStr} className="input" /></div>
        <div><label className="label">Affiliate</label><select name="affiliate" defaultValue={sp.affiliate ?? ""} className="input"><option value="">All</option><option value="direct">Direct (site)</option>{(affs ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">Offer</label><select name="offer" defaultValue={sp.offer ?? ""} className="input"><option value="">All</option>{(offers ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        <div><label className="label">Status</label><select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <button className="btn-primary">Filter</button>
      </form>
      {Object.keys(avsDist).length ? (
        <p className="mt-4 text-sm text-slate-600">AVS in this view: {Object.entries(avsDist).sort((a, b) => b[1] - a[1]).map(([c, n]) => <span key={c} className="mr-3" title={AVS_CODES[c]?.meaning}>{c}: {n}</span>)}</p>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="table bg-white">
          <thead><tr><th>Date</th><th>Invoice / item</th><th>Customer</th><th>Affiliate</th><th>Amount</th><th>Status</th><th>Card</th><th>AVS</th><th>CVV</th><th>Trans ID</th><th /></tr></thead>
          <tbody>
            {(orders ?? []).map((o: any) => {
              const txns = [...(o.transactions ?? [])].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
              const t = txns.find((x: any) => x.transaction_type === "authCaptureTransaction") ?? txns[0];
              const diff = addrDiff(o, t?.bill_to);
              return (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">{new Date(o.created_at).toLocaleString("en-US")}</td>
                  <td>{o.invoice_number}<div className="text-xs text-slate-500">{o.item_name}</div></td>
                  <td>{o.first_name} {o.last_name}<div className="text-xs text-slate-500">{o.email} · {o.phone}<br />{o.address}, {o.city}, {o.state} {o.zip}, {o.country} · IP {o.customer_ip}</div>
                    {diff.length ? <div className="text-xs text-red-600">Authorize.Net billTo differs: {diff.join(", ")}</div> : t?.bill_to ? <div className="text-xs text-green-700">billTo matches Authorize.Net</div> : null}</td>
                  <td>{o.affiliate?.name ?? "Direct"}</td>
                  <td>{usd(o.amount_cents)}</td>
                  <td>{o.status}{t?.response_reason && o.status !== "approved" ? <div className="text-xs text-slate-500">{t.response_reason}</div> : null}{txns.length > 1 ? <div className="text-xs text-slate-500">{txns.length} attempts</div> : null}</td>
                  <td>{t?.card_last4 ? `${t.card_type ?? ""} •••• ${t.card_last4}` : "—"}</td>
                  <td className="text-xs">{avsLabel(t?.avs_result_code)}</td>
                  <td className="text-xs">{cvvLabel(t?.cvv_result_code)}</td>
                  <td className="text-xs">{t?.trans_id ?? "—"}</td>
                  <td className="space-y-1 text-xs">
                    {o.status === "approved" ? (<>
                      <form action={markOrder.bind(null, o.id, "refunded")}><button className="text-red-600 underline">Mark refunded</button></form>
                      <form action={markOrder.bind(null, o.id, "chargeback")}><button className="text-red-600 underline">Mark chargeback</button></form>
                    </>) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing up to 500 orders. Marking refunded/chargeback revokes course access; issue the actual refund in the Authorize.Net merchant interface.</p>
    </div>
  );
}
