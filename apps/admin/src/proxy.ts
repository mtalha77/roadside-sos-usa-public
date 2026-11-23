import { buildCsp, createNonce } from "@rsos/config/security";
import { canOpenPath } from "@rsos/config/permissions";
import { type AccessDecision, adminAccess, withSessionState } from "@rsos/db/claims";
import { strictCookieOptions } from "@rsos/db/cookies";
import { getSessionState, isAuthCookie } from "@rsos/db/session";
import { type NextRequest, NextResponse } from "next/server";

/** Pages anyone may open. Everything else needs staff with the authenticator second step (aal2). */
const PUBLIC = [
  /^\/sign-in(\/|$)/,
  /^\/no-access$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/auth\/callback$/,
  /^\/api\/health$/,
  // Twilio webhooks: no session; every handler checks the X-Twilio-Signature instead.
  /^\/api\/twilio\//,
  // Vercel Cron (checks CRON_SECRET itself).
  /^\/api\/cron\//,
  /^\/robots\.txt$/,
  /^\/(icon|apple-icon|logo\.svg)/,
];

const REDIRECT: Record<Exclude<AccessDecision, "ok">, string> = {
  "sign-in": "/sign-in",
  expired: "/sign-in?expired=1",
  "second-step": "/sign-in/verify",
  forbidden: "/no-access",
  revoked: "/sign-in?signedOut=1",
};

/**
 * Per-request CSP nonce, session refresh (Supabase cookies, Secure + HttpOnly + SameSite=Lax) and
 * route protection for the admin dashboard.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const path = request.nextUrl.pathname;
  let staffSignedIn = false;

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
    const decision = withSessionState(adminAccess(state.claims), state, {
      requireSecondStep: false,
    });
    staffSignedIn = decision === "ok";
    // Role guard (RSOS-102): a page or API outside the role's sections is refused here, not only
    // hidden from the menu. RLS still checks every row in the database.
    if (decision === "ok" && !canOpenPath(state.claims?.staff_role, path)) {
      response = path.startsWith("/api/")
        ? NextResponse.json({ error: "forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/no-access", request.url));
    } else if (decision !== "ok") {
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

  // Owner decision 2: a browser where staff are signed in is test traffic on the website too. The
  // marker is a cookie on the parent domain (staging-admin.x and staging.x share x); preview and
  // local hosts have no shared parent, so nothing is set there.
  const host = request.nextUrl.hostname;
  const parent = host.split(".").slice(1).join(".");
  if (
    staffSignedIn &&
    parent.includes(".") &&
    !/(^|\.)(vercel\.app|localhost)$/.test(host) &&
    request.cookies.get("rsos_test")?.value !== "staff"
  )
    response.cookies.set("rsos_test", "staff", {
      domain: `.${parent}`,
      path: "/",
      maxAge: 30 * 86_400,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
