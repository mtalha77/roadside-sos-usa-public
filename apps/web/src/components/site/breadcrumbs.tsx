import { getSiteUrl } from "@rsos/config/site";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { JsonLd } from "./json-ld";

export type Crumb = { href: string; label: string };

/** Visible breadcrumbs plus BreadcrumbList structured data. */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations("site.nav");
  const all = [{ href: "/", label: t("home") }, ...items];
  const base = getSiteUrl();
  return (
    <>
      <nav
        aria-label={t("breadcrumb")}
        className="mx-auto max-w-6xl px-4 pt-4 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-x-2">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true">{"/"}</span> : null}
              {i === all.length - 1 ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <Link
                  className="inline-flex min-h-touch items-center underline-offset-4 hover:underline"
                  href={c.href}
                >
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: base + c.href,
          })),
        }}
      />
    </>
  );
}
