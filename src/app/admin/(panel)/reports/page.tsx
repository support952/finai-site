import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";
import { parsePeriod } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireRole("admin", "/admin/login/");
  const period = parsePeriod(sp);
  const [{ data: totals, error }, { data: orders }] = await Promise.all([
    supabase.rpc("admin_revenue_by_affiliate", { p_from: period.from.toISOString(), p_to: period.toExclusive.toISOString() }),
    supabase.from("orders").select("created_at, amount_cents, affiliate:affiliates(name)").eq("status", "approved")
      .gte("created_at", period.from.toISOString()).lt("created_at", period.toExclusive.toISOString()).limit(10000),
  ]);
  // Per-month breakdown
  const months = new Map<string, Map<string, number>>();
  for (const o of (orders ?? []) as any[]) {
    const m = o.created_at.slice(0, 7);
    const a = o.affiliate?.name ?? "Direct (site)";
    if (!months.has(m)) months.set(m, new Map());
    months.get(m)!.set(a, (months.get(m)!.get(a) ?? 0) + o.amount_cents);
  }
  const grand = (totals ?? []).reduce((s: number, r: any) => s + Number(r.revenue_cents), 0);
  return (
    <div>
      <h1 className="text-2xl font-bold">Revenue by affiliate</h1>
      <form className="card mt-4 flex flex-wrap items-end gap-3 text-sm">
        <div><label className="label">From</label><input type="date" name="from" defaultValue={period.fromStr} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={period.toStr} className="input" /></div>
        <button className="btn-primary">Apply</button>
      </form>
      {error ? <p className="mt-4 text-red-600">{error.message}</p> : null}
      <table className="table mt-6 bg-white">
        <thead><tr><th>Affiliate</th><th>Approved orders</th><th>Revenue</th></tr></thead>
        <tbody>
          {(totals ?? []).map((r: any) => <tr key={r.affiliate_id ?? "direct"}><td>{r.affiliate_name}</td><td>{r.orders_count}</td><td>{usd(Number(r.revenue_cents))}</td></tr>)}
          <tr><td className="font-semibold">Total</td><td /><td className="font-semibold">{usd(grand)}</td></tr>
        </tbody>
      </table>
      <h2 className="mt-10 text-lg font-semibold">By month</h2>
      <table className="table mt-3 bg-white">
        <thead><tr><th>Month</th><th>Affiliate</th><th>Revenue</th></tr></thead>
        <tbody>
          {[...months.entries()].sort().reverse().flatMap(([m, byAff]) => [...byAff.entries()].map(([a, c]) => <tr key={m + a}><td>{m}</td><td>{a}</td><td>{usd(c)}</td></tr>))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">Approved orders only. No commission is calculated.</p>
    </div>
  );
}
