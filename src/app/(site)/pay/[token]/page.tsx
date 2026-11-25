import type { Metadata } from "next";
import { resolveItem } from "@/lib/checkout/resolve";
import { CheckoutForm } from "@/components/CheckoutForm";
import { usd } from "@/lib/money";
import { site } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** Affiliate payment link: /pay/<signed token>/ */
export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await resolveItem({ type: "link", token });
  if (!item) {
    return (
      <div className="container-page max-w-xl py-16">
        <h1 className="text-2xl font-bold">This payment link is not valid</h1>
        <p className="mt-3 text-slate-600">The link may have expired or been disabled. Please contact the person who sent it, or <a className="underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>
      </div>
    );
  }
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-3xl font-bold">Checkout</h1>
      <CheckoutForm item={{ type: "link", token }} itemName={item.name} amountLabel={usd(item.amountCents)} courseTitles={item.courseTitles} descriptor={site.cardDescriptor} legalName={site.legalName} />
    </div>
  );
}
