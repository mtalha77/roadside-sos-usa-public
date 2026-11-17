import { formatCurrency, type Locale } from "@rsos/i18n";
import { CallButton } from "@/components/softphone/call-button";
import { Badge } from "@rsos/ui/badge";
import { LiteMap } from "@rsos/ui/lite-map";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RequestActions } from "@/components/requests/request-actions";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { getRequestDetail } from "@/lib/requests";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function load(id: string) {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  return { ctx, r: await getRequestDetail(id, now, ctx.demo) };
}

/**
 * Request detail (RSOS-073): driver inputs, map, quotes with times, the chosen provider, full
 * timeline, calls and texts (placeholders until phone service), notes, attribution, fee, review
 * and disputes; actions are logged.
 */
export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, ts, locale, { r }] = await Promise.all([
    getTranslations("admin.requests"),
    getTranslations("site.services"),
    getLocale(),
    load(decodeURIComponent(id)),
  ]);
  if (!r) notFound();
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const time = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeStyle: "medium",
  });
  const status = (s: string) => (t.has(`statuses.${s}`) ? t(`statuses.${s}`) : s);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("detailTitle", { code: r.code })}</h1>
        <Badge tone="info">{status(r.status)}</Badge>
        {r.demo ? <Badge tone="outline">{t("demo")}</Badge> : null}
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="in-h">
            <h2 id="in-h" className="mb-3 font-semibold">
              {t("inputs")}
            </h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">{t("service")}</dt>
              <dd>{ts.has(`${r.service}.name`) ? ts(`${r.service}.name`) : r.service}</dd>
              <dt className="text-muted-foreground">{t("driver")}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {r.driver} · {r.phone}
                {!r.demo && /^\+1\d{10}$/.test(r.phone) ? (
                  <CallButton
                    label={t("callDriver")}
                    call={{ to: r.phone, requestId: r.id, label: r.driver }}
                  />
                ) : null}
              </dd>
              <dt className="text-muted-foreground">{t("location")}</dt>
              <dd>{r.address}</dd>
              <dt className="text-muted-foreground">{t("vehicle")}</dt>
              <dd>{r.vehicle || "—"}</dd>
              <dt className="text-muted-foreground">{t("safety")}</dt>
              <dd>
                {r.safety.length ? r.safety.map((s) => t(`flags.${s}`)).join(" · ") : t("safe")}
              </dd>
              {r.feeCents !== null ? (
                <>
                  <dt className="text-muted-foreground">{t("fee")}</dt>
                  <dd>{money(r.feeCents)}</dd>
                </>
              ) : null}
            </dl>
          </section>
          {r.lat !== null && r.lng !== null ? (
            <section className={card} aria-labelledby="map-h">
              <h2 id="map-h" className="mb-3 font-semibold">
                {t("map")}
              </h2>
              <LiteMap
                label={t("map")}
                points={[{ id: r.id, lat: r.lat, lng: r.lng, kind: "request", label: r.code }]}
              />
            </section>
          ) : null}
          <section className={card} aria-labelledby="q-h">
            <h2 id="q-h" className="mb-3 font-semibold">
              {t("quotes")}
            </h2>
            {r.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noQuotes")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {r.quotes.map((q) => (
                  <li key={q.provider + q.at} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="inline-flex items-center gap-2 font-medium">
                      {q.logo ? <ProviderLogo logo={q.logo} size={24} /> : null}
                      {q.provider}{" "}
                      {r.chosen === q.provider ? <Badge tone="success">{t("chosen")}</Badge> : null}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(q.priceCents)} · {t("eta", { minutes: q.etaMinutes })} ·{" "}
                      {time.format(q.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-labelledby="comm-h">
            <h2 id="comm-h" className="mb-2 font-semibold">
              {t("comms")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("commsPending")}</p>
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="tl-h">
            <h2 id="tl-h" className="mb-3 font-semibold">
              {t("timeline")}
            </h2>
            {r.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
            ) : (
              <ol className="flex flex-col gap-2 border-l pl-4 text-sm">
                {r.timeline.map((x, i) => (
                  <li key={i}>
                    <span className="font-medium">{status(x.label)}</span>{" "}
                    <span className="tabular-nums text-muted-foreground">{time.format(x.at)}</span>
                    {x.detail ? (
                      <span className="block text-muted-foreground">{x.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className={card} aria-labelledby="at-h">
            <h2 id="at-h" className="mb-3 font-semibold">
              {t("attribution")}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {Object.entries(r.attribution).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <RequestActions
            labels={{
              actions: t("actions"),
              note: t("note"),
              addNote: t("addNote"),
              call: t("call"),
              credit: t("credit"),
              dispute: t("dispute"),
              logged: t("logged"),
              review: t("review"),
              noReview: t("noReview"),
            }}
          />
        </div>
      </div>
    </main>
  );
}
