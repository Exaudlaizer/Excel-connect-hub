/**
 * Security headers for every page.
 *
 * The one setting that needs explaining is the Content-Security-Policy. It is
 * built from NEXT_PUBLIC_API_URL so the browser is told exactly which other
 * server the app may talk to.
 *
 * Known limit: `script-src` allows 'unsafe-inline'. Next.js writes inline
 * bootstrap scripts into every page and the theme bootstrap in app/layout.tsx is
 * inline too, so a strict script policy needs per-request nonces (middleware and
 * dynamically rendered pages). Until then this policy still blocks everything
 * else it covers: other origins for scripts and connections, plugins, framing,
 * form posts to other sites, and base-tag tricks. It does NOT stop an attacker
 * who can inject an inline script. See SECURITY.md S-3.
 */

const isProduction = process.env.NODE_ENV === "production";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
const apiOrigin = originOf(apiUrl);
const apiIsHttps = apiOrigin?.startsWith("https://");

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' only for the dev server's hot reloading, never in production.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  // The typefaces are loaded from Google Fonts (see the @import in
  // app/globals.css): the stylesheet from fonts.googleapis.com, the font files
  // from fonts.gstatic.com. Nothing else. Self-hosting them (next/font) would let
  // both of these lines go, and stop sending visitors' IP addresses to Google.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Advertisers can link to any https image, and uploaded images come from the
  // API or a storage host, so https: is needed. The API origin is listed too so a
  // local http API works when testing.
  `img-src 'self' data: blob: https:${apiOrigin ? ` ${apiOrigin}` : ""}`,
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isProduction ? "" : " ws: wss:"}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only when the API is https: upgrading requests to a plain-http local API
  // (development, or testing a production build locally) would just break them.
  ...(isProduction && apiIsHttps ? ["upgrade-insecure-requests"] : [])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers ignore frame-ancestors; this covers them.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Tells browsers to use https for two years. Ignored over plain http, so it is
  // harmless locally, but only sent in production to be explicit.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }] : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
