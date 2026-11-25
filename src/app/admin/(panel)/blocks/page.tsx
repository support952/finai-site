import { requireRole } from "@/lib/auth";
import { releaseBlock } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminBlocks() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const { data: blocks } = await supabase.from("card_blocks").select("*").order("blocked_at", { ascending: false }).limit(200);
  return (
    <div>
      <h1 className="text-2xl font-bold">Card blocks</h1>
      <p className="mt-1 text-sm text-slate-600">A card (last 4 + email) is blocked after 2 declines within 24 hours. While a block is active, new checkouts for that email are refused.</p>
      <table className="table mt-6 bg-white">
        <thead><tr><th>Blocked</th><th>Email</th><th>Card</th><th>Reason</th><th>Status</th><th /></tr></thead>
        <tbody>
          {(blocks ?? []).map((b) => (
            <tr key={b.id}>
              <td>{new Date(b.blocked_at).toLocaleString("en-US")}</td><td>{b.email}</td><td>•••• {b.card_last4}</td><td>{b.reason}</td>
              <td>{b.released_at ? `Released ${new Date(b.released_at).toLocaleString("en-US")}` : "Active"}</td>
              <td>{b.released_at ? null : <form action={releaseBlock.bind(null, b.id)}><button className="btn-secondary">Release</button></form>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
