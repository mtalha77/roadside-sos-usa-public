import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, marketPath } from "@/lib/market";
import { getMarkets } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.about");
  return pageMetadata({ title: t("title"), description: t("intro"), path: "/about" });
}

export default async function AboutPage() {
  const [t, markets] = await Promise.all([getTranslations("pages.about"), getMarkets()]);
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4">
        <section aria-labelledby="mission">
          <h2 id="mission" className="mb-2 text-2xl font-semibold">
            {t("mission")}
          </h2>
          <p>{t("missionBody")}</p>
        </section>
        <section aria-labelledby="how">
          <h2 id="how" className="mb-2 text-2xl font-semibold">
            {t("how")}
          </h2>
          <p>{t("howBody")}</p>
        </section>
        <section aria-label={t("cities")}>
          <p className="mb-2">{t("cities")}</p>
          <ul className="flex flex-wrap gap-x-6">
            {markets.map((m) => (
              <li key={m.slug}>
                <Link
                  className="inline-flex min-h-touch items-center underline underline-offset-4"
                  href={marketPath(m)}
                >
                  {cityLabel(m)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <p>
          <Link
            className="inline-flex min-h-touch items-center underline underline-offset-4"
            href="/contact"
          >
            {t("contact")}
          </Link>
        </p>
      </div>
    </SitePage>
  );
}
