import type { NextConfig } from "next";

// ── Content-Security-Policy (Phase J.3 Part B) ──────────────────────────────
// Shipped as REPORT-ONLY first (see headers() below) so it cannot break
// production — the browser reports violations to the console without enforcing.
// Once verified clean we flip the header name to the enforcing
// `Content-Security-Policy` in a follow-up.
//
// What the app actually loads from off-origin:
//   - images/video display → https://res.cloudinary.com  (img-src / media-src)
//   - direct signed uploads → https://api.cloudinary.com  (connect-src)
//   - fonts: NONE off-origin — next/font/google self-hosts Geist at build time.
//   - scripts/styles: self + inline (Next injects inline bootstrap/flight +
//     Tailwind/React inline styles; we allow 'unsafe-inline' rather than wiring
//     nonces — still blocks off-origin script injection, framing, and form
//     hijacking, which are the attacks that matter here).
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  "font-src 'self'",
  "connect-src 'self' https://api.cloudinary.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Static security headers applied to every route.
const securityHeaders = [
  // Force HTTPS for two years, including subdomains, and allow HSTS preload
  // list inclusion. Only honored over HTTPS (ignored on localhost) — safe.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Don't let browsers MIME-sniff a response into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection (legacy header; CSP frame-ancestors 'none' is the
  // modern equivalent and is set via the report-only CSP + enforced here).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin (not the full path/query) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable powerful features the app never uses (and opt out of FLoC).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // CSP is REPORT-ONLY for now — observe violations before enforcing.
  { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
];

const nextConfig: NextConfig = {
  images: {
    // Custom Cloudinary loader (src/lib/cloudinary-loader.ts): next/image srcset
    // points at Cloudinary-optimized derivatives (f_auto,q_auto,w_<width>), NOT
    // Vercel's metered image optimizer. See the loader file for the rationale.
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
  },
  async headers() {
    return [
      {
        // Every route (pages + API).
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
