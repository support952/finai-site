import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function AdminAffiliates() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const { data: affs } = await supabase.from("affiliates").select("id, name, email, is_active, created_at, affiliate_offers(count)").order("created_at", { ascending: false });
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Affiliates</h1><Link href="/admin/affiliates/new/" className="btn-primary">New affiliate</Link></div>
      <table className="table mt-6 bg-white">
        <thead><tr><th>Name</th><th>Email</th><th>Offers</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {(affs ?? []).map((a: any) => (
            <tr key={a.id}>
              <td><Link href={`/admin/affiliates/${a.id}/`} className="font-medium text-brand-600 hover:underline">{a.name}</Link></td>
              <td>{a.email}</td><td>{a.affiliate_offers?.[0]?.count ?? 0}</td><td>{a.is_active ? "Active" : "Disabled"}</td>
              <td>{new Date(a.created_at).toLocaleDateString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
