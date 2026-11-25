import type { Metadata } from "next";
import { Placeholder } from "@/components/Placeholder";
import { site, companyAddressOneLine } from "@/config/site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="container-page prose-page max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-bold">About {site.name}</h1>
      <p><Placeholder>About page text from finaisolutions.co/about/</Placeholder></p>
      <h2>Company</h2>
      <p>{site.legalName}<br />{companyAddressOneLine}<br /><a href={`mailto:${site.supportEmail}`} className="text-brand-600">{site.supportEmail}</a></p>
    </div>
  );
}
