import { getSiteUrl, isIndexable } from "@rsos/config/site";
import type { MetadataRoute } from "next";

/**
 * Staging and previews: nothing may be crawled. Production: published pages only; the request
 * flow, tracking links, placeholders and APIs are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable("web")) return { rules: { userAgent: "*", disallow: "/" } };
  const base = getSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/get-help", "/r/", "/providers/", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
