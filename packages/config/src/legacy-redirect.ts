import { brand, LEGACY_DOMAINS } from "./brand";

/**
 * RSOS-118: the permanent redirect for a request on a legacy domain, or null. The subdomain is
 * kept (pro., admin., staging., staging-pro., staging-admin.), `www.` goes to the apex, and the
 * path and query are kept. Every app's proxy calls this first, for pages and API routes alike.
 */
export function legacyRedirect(
  url: URL,
  domain: string = brand.domain,
  legacy: readonly string[] = LEGACY_DOMAINS,
): string | null {
  const host = url.hostname.toLowerCase();
  const old = legacy.find((d) => host === d || host.endsWith(`.${d}`));
  if (!old) return null;
  let prefix = host.slice(0, host.length - old.length);
  if (prefix === "www.") prefix = "";
  return `https://${prefix}${domain}${url.pathname}${url.search}`;
}
