import { brand } from "@rsos/config/brand";
import { type LegalDocument, legalDocuments } from "@rsos/config/legal";
import { Alert } from "@rsos/ui/alert";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ doc: string }> };

const isDoc = (d: string): d is LegalDocument => d in legalDocuments;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations(`legal.docs.${doc}`);
  return { title: t("title"), description: t("intro"), alternates: { canonical: `/legal/${doc}` } };
}

/**
 * Legal documents. Each shows its version (stored with every consent) and is marked as a draft
 * until a US attorney has reviewed it.
 */
export default async function LegalPage({ params }: Params) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const [t, tl] = await Promise.all([
    getTranslations(`legal.docs.${doc}`),
    getTranslations("legal"),
  ]);
  const { version } = legalDocuments[doc];
  const sections = t.raw("sections") as [string, string][];
  return (
    <SitePage>
      <Breadcrumbs items={[{ href: `/legal/${doc}`, label: t("title") }]} />
      <article
        className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6"
        data-policy-version={version}
      >
        <Alert tone="warning" title={tl("draftBanner")} />
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground tabular-nums">{tl("version", { version })}</p>
          <p className="text-lg text-muted-foreground">{t("intro")}</p>
        </header>
        <nav aria-labelledby="toc" className="rounded-2xl border bg-card p-4">
          <h2 id="toc" className="mb-2 font-semibold">
            {tl("toc")}
          </h2>
          <ol className="flex list-decimal flex-col gap-1 pl-6">
            {sections.map(([title], i) => (
              <li key={title}>
                <a className="underline-offset-4 hover:underline" href={`#s${i + 1}`}>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map(([title, body], i) => (
          <section
            key={title}
            id={`s${i + 1}`}
            aria-labelledby={`s${i + 1}-h`}
            className="scroll-mt-24"
          >
            <h2 id={`s${i + 1}-h`} className="mb-2 text-2xl font-semibold">
              {[i + 1, title].join(". ")}
            </h2>
            <p>{body}</p>
          </section>
        ))}
        <p className="text-sm text-muted-foreground">
          {tl("contactLine", { email: brand.emails.support })}
        </p>
      </article>
    </SitePage>
  );
}
