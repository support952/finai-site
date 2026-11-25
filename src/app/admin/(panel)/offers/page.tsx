import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/money";

export default async function AdminOffers() {
  const { supabase } = await requireRole("admin", "/admin/login/");
  const { data: offers } = await supabase.from("offers").select("id, name, slug, price_cents, visibility, is_active, offer_courses(count)").order("sort_order");
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Bundles / offers</h1><Link href="/admin/offers/new/" className="btn-primary">New offer</Link></div>
      <table className="table mt-6 bg-white">
        <thead><tr><th>Name</th><th>Price</th><th>Courses</th><th>Visibility</th><th>Active</th></tr></thead>
        <tbody>
          {(offers ?? []).map((o: any) => (
            <tr key={o.id}>
              <td><Link href={`/admin/offers/${o.id}/`} className="font-medium text-brand-600 hover:underline">{o.name}</Link></td>
              <td>{usd(o.price_cents)}</td><td>{o.offer_courses?.[0]?.count ?? 0}</td>
              <td>{o.visibility === "public" ? "Public on site" : "Affiliate-only"}</td><td>{o.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
