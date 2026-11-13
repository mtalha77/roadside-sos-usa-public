import { Button } from "@rsos/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rsos/ui/tabs";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.how");
  return pageMetadata({ title: t("title"), description: t("intro"), path: "/how-it-works" });
}

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="flex flex-col gap-6">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground tabular-nums"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function HowItWorksPage() {
  const t = await getTranslations("pages.how");
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4">
        <Tabs defaultValue="drivers">
          <TabsList aria-label={t("title")} className="w-full">
            <TabsTrigger value="drivers">{t("drivers")}</TabsTrigger>
            <TabsTrigger value="providers">{t("providers")}</TabsTrigger>
          </TabsList>
          <TabsContent value="drivers" className="flex flex-col gap-6 pt-6">
            <h2 className="sr-only">{t("drivers")}</h2>
            <Steps steps={t.raw("driverSteps") as [string, string][]} />
            <Button asChild className="self-start">
              <Link href="/get-help">{t("cta")}</Link>
            </Button>
          </TabsContent>
          <TabsContent value="providers" className="flex flex-col gap-6 pt-6">
            <h2 className="sr-only">{t("providers")}</h2>
            <Steps steps={t.raw("providerSteps") as [string, string][]} />
            <Button asChild variant="outline" className="self-start">
              <Link href="/for-providers">{t("providerCta")}</Link>
            </Button>
          </TabsContent>
        </Tabs>
        <section aria-labelledby="pay" className="rounded-2xl border bg-card p-5">
          <h2 id="pay" className="mb-2 text-2xl font-semibold">
            {t("payTitle")}
          </h2>
          <p>{t("payBody")}</p>
        </section>
      </div>
    </SitePage>
  );
}
