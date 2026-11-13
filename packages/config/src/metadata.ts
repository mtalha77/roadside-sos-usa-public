import type { Metadata } from "next";
import { brand } from "./brand";
import { getSiteUrl, isIndexable } from "./site";

export type AppName = "web" | "provider" | "admin";

const LOCAL_PORT: Record<AppName, number> = { web: 3000, provider: 3001, admin: 3002 };

export type MetadataInput = {
  app: AppName;
  /** Page or app title; the brand name is appended by the template. */
  title?: string;
  description?: string;
  /** Path of the page, for canonical and Open Graph URLs. */
  path?: string;
  env?: Record<string, string | undefined>;
};

/** Shared titles, descriptions, Open Graph, icons and robots for every app. */
export function buildMetadata({
  app,
  title,
  description,
  path = "/",
  env = process.env,
}: MetadataInput): Metadata {
  const siteUrl = getSiteUrl(env, LOCAL_PORT[app]);
  const desc = description ?? brand.description;
  const indexable = isIndexable(app, env);
  return {
    metadataBase: new URL(siteUrl),
    title: title
      ? { default: `${title} | ${brand.name}`, template: `%s | ${brand.name}` }
      : brand.name,
    description: desc,
    applicationName: brand.name,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: title ?? brand.name,
      description: desc,
      url: path,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title: title ?? brand.name, description: desc },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}
