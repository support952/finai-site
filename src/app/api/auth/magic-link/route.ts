import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { magicLinkUrl } from "@/lib/payments/fulfill";
import { sendMail } from "@/lib/mail/mailgun";
import { loginLinkEmail } from "@/lib/mail/templates";
import { clientIp, rateLimit } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Customer magic-link login. Always answers the same way (no account enumeration). */
export async function POST(req: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 422 });
  const ip = await clientIp();
  if (!(await rateLimit(`magic:${ip}`, 5, 900)) || !(await rateLimit(`magic:${parsed.data.email}`, 3, 900))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const { data: profile } = await supabaseAdmin().from("profiles").select("id, role").eq("email", parsed.data.email).maybeSingle();
  if (profile?.role === "customer") {
    const url = await magicLinkUrl(parsed.data.email, "/my-account/");
    await sendMail(loginLinkEmail(parsed.data.email, url));
  }
  return NextResponse.json({ ok: true });
}
