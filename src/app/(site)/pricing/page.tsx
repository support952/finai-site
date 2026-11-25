import type { Metadata } from "next";
import Link from "next/link";
import { listPublicOffers } from "@/lib/catalog";
import { usd } from "@/lib/money";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const offers = await listPublicOffers();
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-slate-600"><Placeholder>Pricing page intro text</Placeholder></p>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {offers.map((o) => (
          <div key={o.id} className="card flex flex-col">
            <h2 className="text-xl font-semibold">{o.name}</h2>
            <p className="mt-2 text-4xl font-bold">{usd(o.price_cents)}</p>
            <p className="mt-1 text-sm text-slate-600">{o.description}</p>
            <ul className="mt-4 flex-1 space-y-1 text-sm">
              {o.courses.map((c) => (
                <li key={c.id}>✓ <Link href={`/product/${c.slug}/`} className="hover:underline">{c.title}</Link></li>
              ))}
            </ul>
            <Link href={`/checkout/?offer=${o.slug}`} className="btn-primary mt-6">Buy {o.name}</Link>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">All prices in USD. One-time payment. See <Link href="/terms-conditions/" className="underline">Terms</Link> and <Link href="/refund-policy/" className="underline">Refund Policy</Link>.</p>
    </div>
  );
}
