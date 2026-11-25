"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function PasswordLoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError("Invalid email or password.");
    router.replace(redirectTo);
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="btn-primary w-full" disabled={busy}>Sign in</button>
    </form>
  );
}
