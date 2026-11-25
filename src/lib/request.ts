import "server-only";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Client IP. Trusts the first X-Forwarded-For hop, which is correct behind
 * Vercel / a reverse proxy that overwrites the header. Adjust if you deploy
 * behind a proxy chain that appends instead.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "0.0.0.0";
}

/** Returns true if the request is allowed. Fails open (logs) if the DB is unreachable. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    log.error("rate limit check failed", { key, error: error.message });
    return true;
  }
  return data === true;
}
