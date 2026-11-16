import "server-only";
import { validateTwilioSignature, webhookAuthToken } from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import type { NextRequest } from "next/server";

/**
 * Twilio webhooks (RSOS-030): every request must carry a valid X-Twilio-Signature for the exact
 * URL Twilio called (including any query, e.g. the Vercel protection bypass on staging), or it
 * gets 403. Handlers are idempotent and answer fast.
 */
export type TwilioRequest = { params: Record<string, string>; url: URL };

export async function readTwilio(request: NextRequest): Promise<TwilioRequest | null> {
  const token = webhookAuthToken();
  if (!token) return null;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  const url = publicUrl(request);
  const ok = validateTwilioSignature(
    token,
    url.toString(),
    params,
    request.headers.get("x-twilio-signature"),
  );
  return ok ? { params, url } : null;
}

/** The URL as the caller saw it (Vercel passes the original host and protocol). */
export function publicUrl(request: NextRequest): URL {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  if (host) url.host = host;
  if (proto) url.protocol = `${proto}:`;
  return url;
}

/** Absolute callback URL on this host, keeping the Vercel bypass parameter when present. */
export function callbackUrl(from: URL, path: string, query: Record<string, string> = {}): string {
  const u = new URL(path, from.origin);
  const bypass = from.searchParams.get("x-vercel-protection-bypass");
  if (bypass) u.searchParams.set("x-vercel-protection-bypass", bypass);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return u.toString();
}

export const forbidden = () => new Response("Forbidden", { status: 403 });
export const xml = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });

/** True the first time this vendor event is seen; false for a repeat delivery. */
export async function firstDelivery(vendor: string, key: string): Promise<boolean> {
  const { error } = await createAdminSupabase()
    .from("webhook_events")
    .insert({ vendor, event_key: key.slice(0, 200) });
  if (!error) return true;
  if (error.code === "23505") return false;
  // Unknown database problem: process anyway (the unique columns downstream still dedupe).
  return true;
}
