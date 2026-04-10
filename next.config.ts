import type { NextConfig } from "next";

/**
 * Content-Security-Policy for Permit-Wiz.
 *
 * Design constraints:
 *  - wagmi / viem use inline styles injected by the RainbowKit stylesheet loader
 *    → `style-src` includes 'unsafe-inline' (can be tightened once nonces are
 *      injected server-side in a future iteration).
 *  - RPC calls go to the public Rootstock nodes and any user-supplied wallet
 *    → `connect-src` lists known Rootstock RPC endpoints; 'self' covers the
 *      Next.js API routes; 'wss:' covers WalletConnect WebSocket.
 *  - No eval() / dynamic code anywhere in the app.
 *  - No frames or embeds are required.
 */
const isDev = process.env.NODE_ENV !== "production";

const ContentSecurityPolicy = [
  // Only load resources from same origin by default
  "default-src 'self'",
  // Scripts: self + Next.js inline bootstrap chunk (cannot be avoided without nonces)
  // Re-added 'unsafe-eval' for development environments (Next.js requires it for HMR & error overlay)
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Styles: self + wagmi/RainbowKit inject inline styles at runtime
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts from Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self + data URIs (wallet icons are data URIs in many connectors)
  "img-src 'self' data: blob: https:",
  // XHR / fetch / WebSocket:
  //   - self (Next.js API routes, prefetch)
  //   - Rootstock Mainnet public RPC
  //   - Rootstock Testnet public RPC
  //   - WalletConnect relay (WebSocket)
  //   - Any HTTPS origin for user-supplied custom RPC
  "connect-src 'self' https://public-node.rsk.co https://public-node.testnet.rsk.co wss://relay.walletconnect.com wss://relay.walletconnect.org https:",
  // Workers: only from same origin
  "worker-src 'self' blob:",
  // Frame ancestors: disallow all embedding (mirrors X-Frame-Options DENY)
  "frame-ancestors 'none'",
  // Disallow <object>, <embed> and <applet>
  "object-src 'none'",
  // Use HTTPS for any upgraded insecure requests
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // MIME sniffing protection
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // HSTS — enforce HTTPS for 1 year including subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Referrer limited to same-origin to avoid leaking data in RPC URLs
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restrict browser features not required by this app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content-Security-Policy to prevent XSS-based signature theft
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
