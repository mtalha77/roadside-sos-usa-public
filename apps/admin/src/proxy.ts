import { buildCsp, createNonce } from "@rsos/config/security";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Per-request Content Security Policy with a nonce. Next.js reads the nonce from the request
 * CSP header and adds it to its own scripts; components read it from `x-nonce`.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every page and API route. Static build assets get the other headers from next.config.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
