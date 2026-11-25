import Link from "next/link";
import { site, companyAddressOneLine } from "@/config/site";

/** Rendered on EVERY page (root layout): company identity + policy links. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-sm text-slate-600">
      <div className="container-page flex flex-col gap-4 py-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-slate-800">{site.legalName}</p>
          <p>{companyAddressOneLine}</p>
          <p>
            <a className="hover:underline" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
            {site.supportPhone ? ` · ${site.supportPhone}` : null}
          </p>
        </div>
        <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
          {site.policies.map((p) => (
            <Link key={p.href} href={p.href} className="hover:underline">{p.label}</Link>
          ))}
          <Link href="/contact/" className="hover:underline">Contact</Link>
        </nav>
      </div>
      <div className="container-page pb-6 text-xs text-slate-500">
        © {new Date().getFullYear()} {site.legalName}. All prices in USD.
      </div>
    </footer>
  );
}
