import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "admin" | "affiliate" | "customer";

export async function currentUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, profile: null } as const;
  const { data: profile } = await supabase.from("profiles").select("id,email,role,full_name").eq("id", data.user.id).single();
  return { supabase, user: data.user, profile } as const;
}

/** For pages/layouts: redirects to the matching login page if not authorised. */
export async function requireRole(role: Role, loginPath: string) {
  const ctx = await currentUser();
  if (!ctx.user || !ctx.profile || ctx.profile.role !== role) redirect(loginPath);
  return ctx as { supabase: typeof ctx.supabase; user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile> };
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertRole(role: Role) {
  const ctx = await currentUser();
  if (!ctx.user || !ctx.profile || ctx.profile.role !== role) throw new Error("Forbidden");
  return ctx as { supabase: typeof ctx.supabase; user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile> };
}

export async function requireAffiliate() {
  const ctx = await requireRole("affiliate", "/partners/login/");
  const { data: affiliate } = await ctx.supabase.from("affiliates").select("id,name,email,is_active").single();
  if (!affiliate || !affiliate.is_active) redirect("/partners/login/?disabled=1");
  return { ...ctx, affiliate };
}
