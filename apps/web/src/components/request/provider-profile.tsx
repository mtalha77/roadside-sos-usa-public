"use client";

import { type DemoQuote, demoProviderProfile } from "@rsos/core/demo";
import { Button } from "@rsos/ui/button";
import { illustrations } from "@rsos/ui/illustrations";
import { LiteMap } from "@rsos/ui/lite-map";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import { SidePanel, SidePanelContent } from "@rsos/ui/side-panel";
import { BadgeCheck, ShieldCheck, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

const card = "rounded-2xl border bg-card p-4";

/**
 * The full provider profile, opened by tapping a quote: a full-height sheet on phones and a side
 * panel on desktop, with a sticky "Choose this provider". Demo providers only (fictional data).
 */
export function ProviderProfilePanel({
  quote,
  licensed,
  onClose,
  onChoose,
}: {
  quote: DemoQuote | null;
  licensed: boolean;
  onClose: () => void;
  onChoose: (q: DemoQuote) => void;
}) {
  const t = useTranslations("track.profile");
  const ts = useTranslations("site.services");
  const f = useFormatter();
  const money = (c: number) => f.number(c / 100, { style: "currency", currency: "USD" });
  const p = quote?.provider;
  const profile = p ? demoProviderProfile(p) : null;
  const total = p?.reviews ?? 0;
  const samples = t.raw("reviewSamples") as string[];
  return (
    <SidePanel open={quote !== null} onOpenChange={(o) => (o ? null : onClose())}>
      {quote && p && profile ? (
        <SidePanelContent
          title={p.name}
          closeLabel={t("close")}
          header={<ProviderLogo logo={p.logo} size={48} />}
          description={
            p.rating ? t("rating", { rating: p.rating.toFixed(1), count: total }) : t("newProvider")
          }
          footer={
            <Button type="button" size="lg" className="w-full" onClick={() => onChoose(quote)}>
              {t("choose", { price: money(quote.priceCents), minutes: quote.etaMinutes })}
            </Button>
          }
        >
          <div className="flex flex-col gap-5">
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <li className="inline-flex items-center gap-1">
                <ShieldCheck aria-hidden="true" className="size-4" />
                {t("insured")}
              </li>
              {licensed ? (
                <li className="inline-flex items-center gap-1">
                  <BadgeCheck aria-hidden="true" className="size-4" />
                  {t("licensed")}
                </li>
              ) : null}
              <li>{t("years", { count: p.years })}</li>
              <li>{t("trucks", { count: p.trucks })}</li>
              <li>{t("based", { area: p.area })}</li>
            </ul>

            <dl className="grid grid-cols-2 gap-3">
              <div className={card}>
                <dt className="text-sm text-muted-foreground">{t("response")}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">
                  {t("seconds", { s: profile.responseSec })}
                </dd>
              </div>
              <div className={card}>
                <dt className="text-sm text-muted-foreground">{t("etaAccuracy")}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">
                  {f.number(profile.etaAccuracy, { style: "percent" })}
                </dd>
              </div>
            </dl>

            <section aria-labelledby="pp-services">
              <h3 id="pp-services" className="mb-2 font-semibold">
                {t("services")}
              </h3>
              <ul className="divide-y rounded-2xl border bg-card">
                {profile.services.map((s) => (
                  <li key={s.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>{ts.has(`${s.slug}.name`) ? ts(`${s.slug}.name`) : s.slug}</span>
                    <span className="font-mono tabular-nums">
                      {t("from", { price: money(s.fromCents) })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="pp-reviews">
              <h3 id="pp-reviews" className="mb-2 font-semibold">
                {t("reviews")}
              </h3>
              {total === 0 ? (
                <p className="text-muted-foreground">{t("noReviews")}</p>
              ) : (
                <>
                  <ul className="mb-3 flex flex-col gap-1">
                    {profile.breakdown.map((n, i) => (
                      <li key={i} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                          {5 - i}
                          <Star aria-hidden="true" className="size-3.5 fill-current" />
                        </span>
                        <span aria-hidden="true" className="h-2 rounded-full bg-muted">
                          <span
                            className="block h-2 rounded-full bg-foreground"
                            style={{ width: `${total ? (n / total) * 100 : 0}%` }}
                          />
                        </span>
                        <span className="text-right text-sm text-muted-foreground tabular-nums">
                          {n}
                          <span className="sr-only"> {t("starReviews", { stars: 5 - i })}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="flex flex-col gap-3">
                    {profile.reviews.map((r, i) => (
                      <li key={i} className={card}>
                        <p className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{r.author}</span>
                          <span className="text-muted-foreground">
                            {t("daysAgo", { count: r.daysAgo })}
                          </span>
                        </p>
                        <p className="sr-only">{t("stars", { count: r.stars })}</p>
                        <p aria-hidden="true" className="my-1 flex gap-0.5">
                          {Array.from({ length: 5 }, (_, k) => (
                            <Star
                              key={k}
                              className={
                                k < r.stars ? "size-4 fill-current" : "size-4 text-muted-foreground"
                              }
                            />
                          ))}
                        </p>
                        <p>{samples[r.text % samples.length]}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section aria-labelledby="pp-photos">
              <h3 id="pp-photos" className="mb-2 font-semibold">
                {t("photos")}
              </h3>
              <ul className="grid grid-cols-3 gap-2">
                {profile.photos.map((kind) => {
                  const Art = illustrations[`job-${kind}`];
                  return (
                    <li
                      key={kind}
                      className="flex flex-col items-center gap-1 rounded-xl border bg-muted/40 p-2 text-muted-foreground"
                    >
                      <Art width={120} className="h-auto w-full" />
                      <span className="text-xs text-foreground">{t(`photoKinds.${kind}`)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="pp-area">
              <h3 id="pp-area" className="mb-2 font-semibold">
                {t("area")}
              </h3>
              <LiteMap
                label={t("areaMap", { miles: profile.radiusMiles })}
                points={[{ id: "base", ...p.home, kind: "provider", label: p.name }]}
                radius={{ center: p.home, miles: profile.radiusMiles }}
              />
            </section>

            <section aria-labelledby="pp-pay">
              <h3 id="pp-pay" className="mb-2 font-semibold">
                {t("payments")}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {p.payments.map((m) => (
                  <li key={m} className="rounded-full border px-3 py-1 text-sm">
                    {t(`methods.${m}`)}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </SidePanelContent>
      ) : null}
    </SidePanel>
  );
}
