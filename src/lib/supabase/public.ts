import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Anonymous (anon key, no cookies) client for public catalogue reads. RLS applies. */
export function supabasePublic() {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), { auth: { persistSession: false } });
}
