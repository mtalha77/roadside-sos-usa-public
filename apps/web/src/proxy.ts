import { buildCsp, createNonce } from "@rsos/config/security";
import { SOURCE_COOKIE, SOURCE_COOKIE_MAX_AGE, sourceForVisit } from "@rsos/core/adapters";
import { ATTRIBUTION_COOKIE, encodeAttribution, firstTouch } from "./lib/attribution";
import { FLOW_COOKIE, newFlowCookie, readFlow } from "./lib/funnel";
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

/** Counts a first visit (fire and forget: never slows the page). */
async function countVisit(market: string | null, source: string) {
  const supabase = createPublicSupabase();
  if (!supabase) return;
  await supabase.rpc("record_visit", { p_market_slug: market ?? "", p_source: source }).then(
    () => undefined,
    () => undefined,
  );
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
  // Booking funnel session (RSOS-111): when the visitor landed and a random id, for this browser
  // session only. The page sees it on this very request too.
  const flow =
    isPage && !readFlow(request.cookies.get(FLOW_COOKIE)?.value) ? newFlowCookie() : null;
  if (flow) {
    const jar = request.headers.get("cookie");
    requestHeaders.set("cookie", `${jar ? `${jar}; ` : ""}${FLOW_COOKIE}=${flow}`);
  }
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (flow)
    response.cookies.set(FLOW_COOKIE, flow, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  // First touch (RSOS-030, 031): on a visitor's first page view, remember for 90 days where they
  // came from (click ids, campaign, landing page, referrer host, market) in a first-party cookie,
  // and count the visit. The site shows that source's phone number; requests carry the attribution.
  if (isPage && !request.cookies.has(ATTRIBUTION_COOKIE)) {
    const attribution = firstTouch(request);
    const source = sourceForVisit(attribution);
    const cookie = {
      path: "/",
      maxAge: SOURCE_COOKIE_MAX_AGE,
      sameSite: "lax" as const,
      secure: request.nextUrl.protocol === "https:",
    };
    response.cookies.set(ATTRIBUTION_COOKIE, encodeAttribution(attribution), {
      ...cookie,
      httpOnly: true,
    });
    if (!request.cookies.has(SOURCE_COOKIE)) response.cookies.set(SOURCE_COOKIE, source, cookie);
    if (!/bot|crawl|spider|lighthouse|headless/i.test(request.headers.get("user-agent") ?? ""))
      void countVisit(attribution.market, source);
  }
  return response;
}

export const config = {
  // Every page and API route. Static build assets get the other headers from next.config.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
