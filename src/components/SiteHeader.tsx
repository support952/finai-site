import Link from "next/link";
import { site } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand-900">{site.name}</Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-700">
          {site.nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-brand-600">{n.label}</Link>
          ))}
          <Link href="/my-account/" className="btn-secondary">My account</Link>
        </nav>
      </div>
    </header>
  );
}
