import { buildCsp, createNonce } from "@rsos/config/security";
import { type AccessDecision, providerAccess, withSessionState } from "@rsos/db/claims";
import { strictCookieOptions } from "@rsos/db/cookies";
import { getSessionState, isAuthCookie } from "@rsos/db/session";
import { type NextRequest, NextResponse } from "next/server";

/** Pages anyone may open. Everything else needs a provider member session (30 days on a trusted device). */
const PUBLIC = [
  /^\/sign-in(\/|$)/,
  /^\/auth\/callback$/,
  /^\/no-access$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/api\/health$/,
  /^\/robots\.txt$/,
  /^\/(icon|apple-icon|logo\.svg)/,
];

const REDIRECT: Record<Exclude<AccessDecision, "ok">, string> = {
  "sign-in": "/sign-in",
  expired: "/sign-in?expired=1",
  "second-step": "/sign-in/second-step",
  forbidden: "/no-access",
  revoked: "/sign-in?signedOut=1",
};

/**
 * Per-request CSP nonce, session refresh and route protection for the provider portal.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const path = request.nextUrl.pathname;

  if (!PUBLIC.some((re) => re.test(path))) {
    const state = await getSessionState(
      {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value } of cookies) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookies)
            response.cookies.set(name, value, options);
        },
      },
      strictCookieOptions,
    );
    const decision = withSessionState(providerAccess(state.claims), state, {
      requireSecondStep: true,
    });
    if (decision !== "ok") {
      const target = new URL(REDIRECT[decision], request.url);
      if (decision === "sign-in" || decision === "second-step")
        target.searchParams.set("next", path);
      response = NextResponse.redirect(target);
      if (decision === "expired" || decision === "revoked") {
        for (const c of request.cookies.getAll())
          if (isAuthCookie(c.name)) response.cookies.delete(c.name);
      }
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
