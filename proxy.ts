import { NextRequest, NextResponse } from "next/server";

/**
 * Generates a cryptographically-random nonce for the request-scoped CSP and
 * rewrites the response's Content-Security-Policy header to embed it.
 *
 * Why: production CSP drops `'unsafe-inline'` from `script-src`. Next.js's
 * automatic <script nonce={…}> injection picks the nonce up from the
 * `x-nonce` request header, so it must be set here before the page renders.
 */
export function proxy(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  // Generate a 128-bit random nonce. `btoa(String.fromCharCode(...))` is used
  // because `Buffer` is not available in the Next.js Edge runtime.
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...randomBytes));

  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://public-node.rsk.co https://public-node.testnet.rsk.co wss://relay.walletconnect.com wss://relay.walletconnect.org https:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
