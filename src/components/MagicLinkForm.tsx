"use client";
import { useState } from "react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/auth/magic-link/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) setState("sent");
    else {
      setState("error");
      setMsg((await res.json().catch(() => ({}))).error ?? "Something went wrong");
    }
  }
  if (state === "sent") return <p className="mt-6 rounded bg-green-50 p-4 text-sm text-green-800">If an account exists for {email}, a sign-in link is on its way.</p>;
  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input type="email" required className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      {state === "error" ? <p className="text-sm text-red-600">{msg}</p> : null}
      <button className="btn-primary w-full" disabled={state === "busy"}>Email me a sign-in link</button>
    </form>
  );
}
