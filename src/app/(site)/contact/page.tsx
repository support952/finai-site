import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";
import { site, companyAddressOneLine } from "@/config/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container-page prose-page max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-bold">Contact</h1>
      <p><Placeholder>Contact page intro text</Placeholder></p>
      <p><strong>Email:</strong> <a href={`mailto:${site.supportEmail}`} className="text-brand-600">{site.supportEmail}</a></p>
      {site.supportPhone ? <p><strong>Phone:</strong> {site.supportPhone}</p> : null}
      <p><strong>Mail:</strong> {site.legalName}, {companyAddressOneLine}</p>
    </div>
  );
}
