import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveItem } from "@/lib/checkout/resolve";
import { CheckoutForm } from "@/components/CheckoutForm";
import { usd } from "@/lib/money";
import { site } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ offer?: string; course?: string }> }) {
  const sp = await searchParams;
  const ref = sp.offer ? ({ type: "offer", slug: sp.offer } as const) : sp.course ? ({ type: "course", slug: sp.course } as const) : null;
  if (!ref) notFound();
  const item = await resolveItem(ref);
  if (!item) notFound();
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-3xl font-bold">Checkout</h1>
      <CheckoutForm item={ref} itemName={item.name} amountLabel={usd(item.amountCents)} courseTitles={item.courseTitles} descriptor={site.cardDescriptor} legalName={site.legalName} />
    </div>
  );
}
