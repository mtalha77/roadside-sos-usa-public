import { z } from "zod";

export const RedirectSchema = z.object({
  source_path: z.string(),
  destination: z.string(),
  status_code: z.union([z.literal(301), z.literal(308)]),
});
export type RedirectRule = z.infer<typeof RedirectSchema>;

/**
 * Where a request should go instead, or null. Legacy hosts (an old domain after a rename, set in
 * REDIRECT_FROM_HOSTS) move to the canonical host with the same path and query; moved pages follow
 * the `redirects` table (exact path, trailing slash ignored).
 */
export function resolveRedirect(
  url: URL,
  rules: RedirectRule[],
  opts: { canonicalOrigin: string | null; legacyHosts: string[] },
): { location: string; status: 301 | 308 } | null {
  if (opts.canonicalOrigin && opts.legacyHosts.includes(url.host.toLowerCase())) {
    return {
      location: new URL(url.pathname + url.search, opts.canonicalOrigin).toString(),
      status: 301,
    };
  }
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const rule = rules.find((r) => r.source_path === path);
  if (!rule) return null;
  const target = new URL(rule.destination, url.origin);
  if (!rule.destination.includes("?")) target.search = url.search;
  return { location: target.toString(), status: rule.status_code };
}

export const legacyHostsFromEnv = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
