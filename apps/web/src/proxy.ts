import { buildCsp, createNonce } from "@rsos/config/security";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  legacyHostsFromEnv,
  type RedirectRule,
  RedirectSchema,
  resolveRedirect,
} from "./lib/redirects";

// Redirect rules from the database, cached per server instance for 5 minutes.
let cache: { at: number; rules: RedirectRule[] } | null = null;
async function redirectRules(): Promise<RedirectRule[]> {
  if (cache && Date.now() - cache.at < 300_000) return cache.rules;
  const supabase = createPublicSupabase();
  let rules: RedirectRule[] = cache?.rules ?? [];
  if (supabase) {
    const { data, error } = await (
      supabase.rpc as (f: string) => PromiseLike<{ data: unknown; error: unknown }>
    )("list_redirects");
    const parsed = z.array(RedirectSchema).safeParse(data);
    if (!error && parsed.success) rules = parsed.data;
  }
  cache = { at: Date.now(), rules };
  return rules;
}

/**
 * Permanent redirects (legacy domain after a rename, moved pages), then a per-request Content
 * Security Policy with a nonce. Next.js reads the nonce from the request CSP header and adds it to
 * its own scripts; components read it from `x-nonce`.
 */
export async function proxy(request: NextRequest) {
  const isPage = !request.nextUrl.pathname.startsWith("/api/");
  if (isPage) {
    const target = resolveRedirect(new URL(request.url), await redirectRules(), {
      canonicalOrigin: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      legacyHosts: legacyHostsFromEnv(process.env.REDIRECT_FROM_HOSTS),
    });
    if (target) return NextResponse.redirect(target.location, target.status);
  }

  const nonce = createNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every page and API route. Static build assets get the other headers from next.config.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
