import { getSiteUrl } from "@rsos/config/site";
import { getMarkets, getMarketServices, getServices } from "@/lib/site-data";
import { SITEMAPS, type SitemapName, sitemapPaths, urlsetXml } from "@/lib/sitemap";

/** One sitemap of the index, from published database rows (cached and refreshed with the pages). */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name.replace(/\.xml$/, "") as SitemapName;
  if (!SITEMAPS.includes(name)) return new Response("Not found", { status: 404 });
  const [markets, services] = await Promise.all([getMarkets(), getServices()]);
  const marketServices =
    name === "city-services"
      ? Object.fromEntries(
          await Promise.all(
            markets.map(async (m) => [m.slug, await getMarketServices(m.slug)] as const),
          ),
        )
      : {};
  return new Response(
    urlsetXml(getSiteUrl(), sitemapPaths(name, { markets, services, marketServices })),
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
