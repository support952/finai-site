import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";

export default async function AdminHome() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: recent }, { count: courses }, { count: blocks }] = await Promise.all([
    supabase.from("orders").select("id, created_at, item_name, amount_cents, status, email").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("card_blocks").select("id", { count: "exact", head: true }).is("released_at", null),
  ]);
  const approved = (recent ?? []).filter((o) => o.status === "approved");
  const declined = (recent ?? []).filter((o) => o.status === "declined").length;
  const revenue = approved.reduce((s, o) => s + o.amount_cents, 0);
  const rate = approved.length + declined ? Math.round((approved.length / (approved.length + declined)) * 100) : null;
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="card"><p className="text-sm text-slate-500">Revenue (30 days)</p><p className="text-2xl font-bold">{usd(revenue)}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Approved / declined</p><p className="text-2xl font-bold">{approved.length} / {declined}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Approval rate</p><p className="text-2xl font-bold">{rate == null ? "—" : `${rate}%`}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Courses · active blocks</p><p className="text-2xl font-bold">{courses ?? 0} · {blocks ?? 0}</p></div>
      </div>
      <div className="mt-8 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent orders</h2><Link href="/admin/transactions/" className="text-sm text-brand-600 hover:underline">All transactions →</Link></div>
      <table className="table mt-3 bg-white">
        <thead><tr><th>Date</th><th>Item</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {(recent ?? []).slice(0, 15).map((o) => (
            <tr key={o.id}><td>{new Date(o.created_at).toLocaleString("en-US")}</td><td>{o.item_name}</td><td>{o.email}</td><td>{usd(o.amount_cents)}</td><td>{o.status}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
