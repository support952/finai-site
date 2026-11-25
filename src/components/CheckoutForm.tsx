"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COUNTRY_CODES, regionsFor } from "@/lib/checkout/geo";

type ItemRef = { type: "offer"; slug: string } | { type: "course"; slug: string } | { type: "link"; token: string };

interface Props {
  item: ItemRef;
  itemName: string;
  amountLabel: string;
  courseTitles: string[];
  descriptor: string;
  legalName: string;
}

type Field = "firstName" | "lastName" | "email" | "phone" | "address" | "city" | "state" | "zip" | "country";

declare global {
  interface Window {
    AuthorizeNetIFrame?: { onReceiveCommunication: (q: string) => void };
  }
}

export function CheckoutForm(p: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "", zip: "", country: "US",
  });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<{ token: string; formUrl: string; publicId: string } | null>(null);
  const [iframeHeight, setIframeHeight] = useState(640);
  const postFormRef = useRef<HTMLFormElement>(null);

  const countryNames = useMemo(() => {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return COUNTRY_CODES.map((c) => ({ code: c, name: dn.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const regions = regionsFor(values.country);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setValues((s) => ({ ...s, [k]: v, ...(k === "country" ? { state: "" } : {}) }));
  };

  // Auto-submit the token to the iframe once we have it.
  useEffect(() => {
    if (payment) postFormRef.current?.submit();
  }, [payment]);

  // Messages relayed by /anet/iframe-communicator.html
  useEffect(() => {
    if (!payment) return;
    window.AuthorizeNetIFrame = {
      onReceiveCommunication: async (query: string) => {
        const params = new URLSearchParams(query);
        const action = params.get("action");
        if (action === "resizeWindow") {
          const h = Number(params.get("height"));
          if (h > 0) setIframeHeight(Math.min(Math.max(h + 40, 400), 1400));
        } else if (action === "cancel") {
          setPayment(null);
        } else if (action === "transactResponse") {
          let transId = "";
          try {
            transId = String(JSON.parse(params.get("response") ?? "{}").transId ?? "");
          } catch {}
          if (/^\d+$/.test(transId) && transId !== "0") {
            await fetch("/api/checkout/confirm/", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ publicId: payment.publicId, transId }),
            }).catch(() => {});
          }
          // The result page reads the STORED status — never this message.
          router.push(`/checkout/result/${payment.publicId}/`);
        }
      },
    };
    return () => {
      delete window.AuthorizeNetIFrame;
    };
  }, [payment, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/checkout/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item: p.item, customer: values, acceptTerms: accept }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(json.fields ?? {});
        setFormError(json.error ?? "Something went wrong.");
        return;
      }
      setPayment(json);
    } finally {
      setBusy(false);
    }
  }

  const input = (k: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={k}>{label} *</label>
      <input id={k} name={k} className="input" required value={values[k]} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] ? <p className="mt-1 text-xs text-red-600">{errors[k]}</p> : null}
    </div>
  );

  return (
    <div className="grid gap-8 md:grid-cols-5">
      <div className="md:col-span-3">
        {!payment ? (
          <form onSubmit={submit} noValidate className="space-y-4">
            <h2 className="text-lg font-semibold">Billing details</h2>
            <p className="text-sm text-slate-600">Enter the name and address exactly as they appear on your card statement.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {input("firstName", "First name", { autoComplete: "given-name", maxLength: 50 })}
              {input("lastName", "Last name", { autoComplete: "family-name", maxLength: 50 })}
              {input("email", "Email", { type: "email", autoComplete: "email", maxLength: 255 })}
              {input("phone", "Phone", { type: "tel", autoComplete: "tel", maxLength: 25 })}
            </div>
            <div>
              <label className="label" htmlFor="country">Country *</label>
              <select id="country" className="input" required value={values.country} onChange={set("country")} autoComplete="country">
                {countryNames.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              {errors.country ? <p className="mt-1 text-xs text-red-600">{errors.country}</p> : null}
            </div>
            {input("address", "Street address", { autoComplete: "street-address", maxLength: 60 })}
            <div className="grid gap-4 sm:grid-cols-3">
              {input("city", "City", { autoComplete: "address-level2", maxLength: 40 })}
              <div>
                <label className="label" htmlFor="state">{values.country === "US" ? "State" : "State / region"} *</label>
                {regions ? (
                  <select id="state" className="input" required value={values.state} onChange={set("state")} autoComplete="address-level1">
                    <option value="">Select…</option>
                    {Object.entries(regions).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                ) : (
                  <input id="state" className="input" required maxLength={40} value={values.state} onChange={set("state")} autoComplete="address-level1" />
                )}
                {errors.state ? <p className="mt-1 text-xs text-red-600">{errors.state}</p> : null}
              </div>
              {input("zip", values.country === "US" ? "ZIP code" : "Postal code", { autoComplete: "postal-code", maxLength: 20 })}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
              <span>I agree to the <Link href="/terms-conditions/" target="_blank" className="underline">Terms &amp; Conditions</Link>, <Link href="/refund-policy/" target="_blank" className="underline">Refund Policy</Link> and <Link href="/privacy-policy/" target="_blank" className="underline">Privacy Policy</Link>.</span>
            </label>
            {errors.acceptTerms ? <p className="text-xs text-red-600">{errors.acceptTerms}</p> : null}
            {formError ? <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{formError}</p> : null}
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy ? "Please wait…" : "Continue to secure payment"}</button>
          </form>
        ) : (
          <div>
            <h2 className="mb-2 text-lg font-semibold">Card payment</h2>
            <p className="mb-4 text-sm text-slate-600">Card details are entered on Authorize.Net&apos;s secure form and never touch our servers.</p>
            <form ref={postFormRef} method="post" action={payment.formUrl} target="anet_iframe" className="hidden">
              <input type="hidden" name="token" value={payment.token} />
            </form>
            <iframe name="anet_iframe" title="Secure payment form" className="w-full rounded border border-slate-200" style={{ height: iframeHeight }} />
            <button type="button" onClick={() => setPayment(null)} className="mt-3 text-sm text-slate-600 underline">← Edit billing details</button>
          </div>
        )}
      </div>
      <aside className="md:col-span-2">
        <div className="card">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <p className="mt-3 font-medium">{p.itemName}</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">{p.courseTitles.map((t) => <li key={t}>• {t}</li>)}</ul>
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold"><span>Total (USD)</span><span>{p.amountLabel}</span></div>
          <p className="mt-4 text-xs text-slate-500">
            Sold by {p.legalName}. Your statement will show <strong>{p.descriptor}</strong>. Digital product — instant access after payment.
          </p>
        </div>
      </aside>
    </div>
  );
}
