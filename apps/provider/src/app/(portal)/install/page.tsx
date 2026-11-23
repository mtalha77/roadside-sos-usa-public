import { getTranslations } from "next-intl/server";
import { card, PageHead, pageMain } from "@/components/shell/page-head";

/** Install guide for iPhone and Android (RSOS-051). */
export default async function InstallPage() {
  const t = await getTranslations("portal.install");
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("body")} />
      <div className="grid gap-4 md:grid-cols-2">
        {(["iphone", "android"] as const).map((os) => (
          <section key={os} className={card} aria-labelledby={`os-${os}`}>
            <h2 id={`os-${os}`} className="mb-3 text-xl font-semibold">
              {t(os)}
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              {(t.raw(`${os}Steps`) as string[]).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
