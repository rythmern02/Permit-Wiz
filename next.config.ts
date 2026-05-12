import type { NextConfig } from "next";

/**
 * Security headers for Permit-Wiz.
 *
 * The Content-Security-Policy itself is generated per-request in
 * `middleware.ts` so that a fresh `nonce-…` can be embedded in `script-src`
 * for each response. That eliminates `'unsafe-inline'` from production
 * script execution and closes the XSS vector previously flagged in audit
 * round 2 (#R2-4) / round 3 (#C2).
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
