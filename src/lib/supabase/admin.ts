import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | undefined;

/**
 * Service-role client: BYPASSES RLS. Server-only. Use exclusively for
 * checkout, webhooks, fulfillment and storage signing — never with input that
 * hasn't been authorised.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
