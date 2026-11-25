import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";
import { site, companyAddressOneLine } from "@/config/site";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <div className="container-page prose-page max-w-3xl py-12">
      <h1 className="mb-2 text-3xl font-bold">Terms & Conditions</h1>
      <p className="text-sm text-slate-500"><Placeholder>Last updated date</Placeholder></p>
      <p><Placeholder>Paste the full current Terms & Conditions text from finaisolutions.co/terms-conditions/ here, unchanged.</Placeholder></p>
      <h2>Contact</h2>
      <p>{site.legalName}, {companyAddressOneLine} · <a href={`mailto:${site.supportEmail}`} className="text-brand-600">{site.supportEmail}</a></p>
    </div>
  );
}
