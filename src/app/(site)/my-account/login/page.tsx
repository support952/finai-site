import type { Metadata } from "next";
import { MagicLinkForm } from "@/components/MagicLinkForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-page max-w-md py-16">
      <h1 className="text-2xl font-bold">Sign in to My Account</h1>
      <p className="mt-2 text-sm text-slate-600">Enter the email you used at checkout. We&apos;ll email you a sign-in link.</p>
      {sp.expired ? <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">That link has expired or was already used. Request a new one below.</p> : null}
      <MagicLinkForm />
    </div>
  );
}
