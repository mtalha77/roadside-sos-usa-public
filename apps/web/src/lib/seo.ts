import { brand } from "@rsos/config/brand";
import { isIndexable } from "@rsos/config/site";
import type { Metadata } from "next";

/**
 * Title, description, canonical URL, Open Graph and robots for a website page, from one template
 * (RSOS-032). `title` gets " | Brand" appended unless `absolute` is set. Pages that must never be
 * indexed (the request flow, tracking links, placeholders) pass `noindex`; staging and previews are
 * never indexable whatever the page says.
 */
export function pageMetadata({
  title,
  description,
  path,
  absolute = false,
  noindex = false,
}: {
  title: string;
  description?: string;
  path: string;
  absolute?: boolean;
  noindex?: boolean;
}): Metadata {
  const full = absolute ? title : `${title} | ${brand.name}`;
  const index = !noindex && isIndexable("web");
  return {
    title: absolute ? { absolute: title } : title,
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: full,
      ...(description ? { description } : {}),
      url: path,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title: full, ...(description ? { description } : {}) },
    robots: index ? { index: true, follow: true } : { index: false, follow: !noindex },
  };
}
