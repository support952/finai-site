import type { Metadata } from "next";
import { requireAffiliate } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner panel", robots: { index: false } };

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { affiliate } = await requireAffiliate();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-bold text-brand-900">FINAI Partners</span>
          <form action="/partners/logout/" method="post" className="text-sm">{affiliate.name} · <button className="underline">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
