import { Check, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ServicePage } from "@/lib/site-data";
import { FaqList } from "./faq-list";

/** What a service covers, what to expect, time on site, safety tips and FAQ (from `service_pages`). */
export async function ServiceDetails({
  page,
  serviceLabel,
}: {
  page: ServicePage;
  serviceLabel: string;
}) {
  const t = await getTranslations("site.service");
  const list = "flex flex-col gap-2";
  return (
    <div className="flex flex-col gap-12">
      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="svc-covers">
          <h2 id="svc-covers" className="mb-3 text-2xl font-semibold">
            {t("covers")}
          </h2>
          <ul className={list}>
            {page.covers.map((c) => (
              <li key={c} className="flex gap-2">
                <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-success-strong" />
                {c}
              </li>
            ))}
          </ul>
          {page.not_covered.length ? (
            <>
              <h3 className="mt-6 mb-3 text-lg font-semibold">{t("notCovered")}</h3>
              <ul className={list}>
                {page.not_covered.map((c) => (
                  <li key={c} className="flex gap-2 text-muted-foreground">
                    <X aria-hidden="true" className="mt-1 size-5 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section aria-labelledby="svc-expect">
          <h2 id="svc-expect" className="mb-3 text-2xl font-semibold">
            {t("expect")}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-6">
            {page.what_to_expect.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          {page.onsite_minutes_min && page.onsite_minutes_max ? (
            <p className="mt-4">
              <span className="font-semibold">{t("typicalTime")}</span>
              <br />
              <span className="tabular-nums">
                {t("minutes", { min: page.onsite_minutes_min, max: page.onsite_minutes_max })}
              </span>
            </p>
          ) : null}
        </section>
      </div>
      {page.safety_tips.length ? (
        <section aria-labelledby="svc-safety" className="rounded-2xl border bg-card p-5">
          <h2 id="svc-safety" className="mb-3 text-2xl font-semibold">
            {t("safety")}
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-6">
            {page.safety_tips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {page.faqs.length ? (
        <section aria-labelledby="svc-faq" className="flex flex-col gap-4">
          <h2 id="svc-faq" className="text-2xl font-semibold">
            {t("faq", { service: serviceLabel })}
          </h2>
          <FaqList items={page.faqs.map((f, i) => ({ id: `faq-${i + 1}`, q: f.q, a: f.a }))} />
        </section>
      ) : null}
    </div>
  );
}
