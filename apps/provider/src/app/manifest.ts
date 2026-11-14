import { brand } from "@rsos/config/brand";
import { themeColor } from "@rsos/config/theme-colors";
import type { MetadataRoute } from "next";

/** Installable web app (RSOS-051). */
export default function manifest(): MetadataRoute.Manifest {
  return {
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
  };
}
