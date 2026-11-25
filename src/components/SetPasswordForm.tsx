"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function SetPasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 12) return setError("Use at least 12 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) return setError(error.message);
    router.replace(redirectTo);
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div><label className="label" htmlFor="pw">New password</label><input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
      <div><label className="label" htmlFor="pw2">Repeat password</label><input id="pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="btn-primary w-full">Save password</button>
    </form>
  );
}
