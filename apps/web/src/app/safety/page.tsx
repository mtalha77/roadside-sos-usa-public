import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.safetyPage");
  return { title: t("title"), description: t("intro"), alternates: { canonical: "/safety" } };
}

export default async function SafetyPage() {
  const t = await getTranslations("pages.safetyPage");
  const sections = t.raw("sections") as [string, string][];
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")} />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-2">
        {sections.map(([title, body]) => (
          <section key={title} className="rounded-2xl border bg-card p-5">
            <h2 className="mb-2 text-xl font-semibold">{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
    </SitePage>
  );
}
