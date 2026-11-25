import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anetHosts = "https://test.authorize.net https://accept.authorize.net";

// Next.js App Router injects inline bootstrap scripts, hence 'unsafe-inline' for scripts.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabase}`.trim(),
  `frame-src ${anetHosts}`,
  `form-action 'self' ${anetHosts}`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const common = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // WordPress/WooCommerce URLs end with "/" — keep them identical.
  trailingSlash: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the Accept Hosted iframe communicator
        source: "/((?!anet/iframe-communicator\\.html).*)",
        headers: [...common, { key: "Content-Security-Policy", value: csp }, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        // Loaded inside Authorize.Net's iframe, which is inside our page.
        source: "/anet/iframe-communicator.html",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'self' ${anetHosts}` },
        ],
      },
      { source: "/(admin|partners|my-account|checkout|pay|api)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  async redirects() {
    return [
      // Common WooCommerce paths that may be linked externally
      { source: "/shop/", destination: "/courses/", permanent: true },
      { source: "/cart/", destination: "/pricing/", permanent: false },
      { source: "/my-courses/", destination: "/my-account/", permanent: true },
      { source: "/terms-and-conditions/", destination: "/terms-conditions/", permanent: true },
      { source: "/wp-admin/:path*", destination: "/admin/", permanent: false },
      { source: "/wp-login.php", destination: "/my-account/login/", permanent: false },
    ];
  },
};

export default nextConfig;
