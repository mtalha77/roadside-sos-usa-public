import { getSiteUrl } from "@rsos/config/site";
import { indexXml } from "@/lib/sitemap";

/** Sitemap index: pages, cities, services and city plus service sitemaps. */
export function GET() {
  return new Response(indexXml(getSiteUrl()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
