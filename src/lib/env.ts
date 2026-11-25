import "server-only";

/**
 * Server-side environment access. Values are read lazily (so `next build`
 * works without secrets) and are NEVER logged or returned to clients.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required environment variable ${name}`);
  return v.trim();
}

export const env = {
  siteUrl: () => required("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  authnetEnv: (): "sandbox" | "production" => {
    const v = (process.env.AUTHNET_ENV ?? "sandbox").trim().toLowerCase();
    if (v === "production") {
      // Two-key switch so production is never hit by accident.
      if (process.env.AUTHNET_ALLOW_PRODUCTION !== "true") {
        throw new Error("AUTHNET_ENV=production requires AUTHNET_ALLOW_PRODUCTION=true");
      }
      return "production";
    }
    return "sandbox";
  },
  authnetLoginId: () => required("AUTHNET_API_LOGIN_ID"),
  authnetTransactionKey: () => required("AUTHNET_TRANSACTION_KEY"),
  authnetSignatureKey: () => required("AUTHNET_SIGNATURE_KEY"),

  linkSigningSecret: () => {
    const v = required("LINK_SIGNING_SECRET");
    if (v.length < 32) throw new Error("LINK_SIGNING_SECRET must be at least 32 characters");
    return v;
  },

  mailgunApiKey: () => required("MAILGUN_API_KEY"),
  mailgunDomain: () => required("MAILGUN_DOMAIN"),
  mailgunApiBase: () => (process.env.MAILGUN_API_BASE ?? "https://api.mailgun.net").replace(/\/+$/, ""),
  mailFrom: () => required("MAIL_FROM"),
  adminNotifyEmail: () => process.env.ADMIN_NOTIFY_EMAIL?.trim() || undefined,
};
