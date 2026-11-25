import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/my-account/", "/partners/set-password/", "/admin/set-password/"];

/** Verifies a token_hash from our emails and sets the session cookie. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/my-account/";
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "/my-account/";
  if (tokenHash && type && ["email", "recovery", "magiclink", "invite"].includes(type)) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }
  return NextResponse.redirect(new URL("/my-account/login/?expired=1", req.url));
}
