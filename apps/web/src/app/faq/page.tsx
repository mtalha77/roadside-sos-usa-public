import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { FaqList } from "@/components/site/faq-list";
import { FaqSearch } from "@/components/site/faq-search";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

const GROUPS = ["drivers", "prices", "safety", "providers"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.faqPage");
  return pageMetadata({ title: t("title"), description: t("intro"), path: "/faq" });
}

/** FAQ: grouped, searchable, with one FAQPage block for every question. */
export default async function FaqPage() {
  const t = await getTranslations("pages.faqPage");
  const groups = GROUPS.map((g) => ({
    id: g,
    title: t(`groups.${g}`),
    items: (t.raw(`items.${g}`) as [string, string][]).map(([q, a], i) => ({
      id: `${g}-${i + 1}`,
      q,
      a,
    })),
  }));
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4">
        <FaqSearch label={t("search")} noResults={t("noResults", { query: "{query}" })} />
        {groups.map((g) => (
          <section
            key={g.id}
            data-faq-group
            aria-labelledby={`faq-${g.id}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`faq-${g.id}`} className="text-2xl font-semibold">
              {g.title}
            </h2>
            <FaqList items={g.items} withSchema={false} />
          </section>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups
            .flatMap((g) => g.items)
            .map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
        }}
      />
    </SitePage>
  );
}
