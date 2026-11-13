import { getSiteUrl, isIndexable } from "@rsos/config/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable("admin")) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, host: getSiteUrl() };
}
