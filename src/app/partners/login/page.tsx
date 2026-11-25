import type { Metadata } from "next";
import { PasswordLoginForm } from "@/components/PasswordLoginForm";

export const metadata: Metadata = { title: "Partner sign in", robots: { index: false } };

export default async function PartnerLogin({ searchParams }: { searchParams: Promise<{ disabled?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-2xl font-bold">Partner sign in</h1>
      {sp.disabled ? <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">This partner account is disabled.</p> : null}
      <PasswordLoginForm redirectTo="/partners/" />
    </div>
  );
}
