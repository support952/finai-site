import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  ["/admin/", "Dashboard"],
  ["/admin/courses/", "Courses"],
  ["/admin/categories/", "Categories & levels"],
  ["/admin/offers/", "Bundles / offers"],
  ["/admin/affiliates/", "Affiliates"],
  ["/admin/transactions/", "Transactions"],
  ["/admin/reports/", "Reports"],
  ["/admin/blocks/", "Card blocks"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole("admin", "/admin/login/");
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="font-bold">FINAI Admin</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="hover:underline">{label}</Link>)}
          </nav>
          <form action="/admin/logout/" method="post" className="text-sm">{profile.email} · <button className="underline">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
