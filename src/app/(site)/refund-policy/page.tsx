import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";
import { site, companyAddressOneLine } from "@/config/site";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <div className="container-page prose-page max-w-3xl py-12">
      <h1 className="mb-2 text-3xl font-bold">Refund Policy</h1>
      <p className="text-sm text-slate-500"><Placeholder>Last updated date</Placeholder></p>
      <p><Placeholder>Paste the full current Refund Policy text from finaisolutions.co/refund-policy/ here, unchanged.</Placeholder></p>
      <h2>Contact</h2>
      <p>{site.legalName}, {companyAddressOneLine} · <a href={`mailto:${site.supportEmail}`} className="text-brand-600">{site.supportEmail}</a></p>
    </div>
  );
}
