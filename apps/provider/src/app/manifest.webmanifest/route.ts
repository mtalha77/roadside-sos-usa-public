import { brand } from "@rsos/config/brand";
import { themeColor } from "@rsos/config/theme-colors";

/**
 * Installable web app (RSOS-051). Served as a route (not manifest.ts) so the root layout can link
 * it with crossorigin="use-credentials": browsers fetch manifests without cookies by default,
 * which protected preview deployments answer with an endless redirect.
 */
export function GET() {
  return Response.json(
    {
      name: `${brand.name} for providers`,
      short_name: brand.shortName,
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: themeColor.dark,
      theme_color: themeColor.dark,
      icons: [
        { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
