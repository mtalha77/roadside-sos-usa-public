import { loadProviderStatus } from "@rsos/account/server";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { LiteMap } from "@rsos/ui/lite-map";
import { StatCard } from "@rsos/ui/stat-card";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OnlinePanel } from "@/components/home/online-panel";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { isPhoneVerified, phoneVerifier } from "@/lib/phone";
import { getPortalContext, getPortalData, getWalletBalance } from "@/lib/portal";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LOW_BALANCE_CENTS = 5000;

async function load() {
  const ctx = await getPortalContext();
  const [{ data }, balance] = await Promise.all([
    getPortalData(ctx, Date.now()),
    getWalletBalance(ctx.providerId),
  ]);
  return { ctx, data, balance };
}

/**
 * Provider home (RSOS-053): go online, today's numbers, wallet balance and anything blocking jobs,
 * each with a one-tap fix. A verified phone is required first (RSOS-018).
 */
export default async function ProviderHome() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");
  const status = await loadProviderStatus();
  if (status && ["paused", "suspended", "closed"].includes(status.status))
    redirect("/account-status");
  if (!isPhoneVerified(auth.user, phoneVerifier(supabase).kind)) redirect("/verify-phone");
  // Technicians have no home page: their jobs are the start (RSOS-104). Redirecting here, not
  // only in the proxy, also moves the address bar after a sign-in.
  if (status?.role === "operator") redirect("/jobs");
  const [t, locale, { ctx, data, balance }] = await Promise.all([
    getTranslations("portal.home"),
    getLocale(),
    load(),
  ]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const p = data.provider;
  const blockers = [
    ...(ctx.canSeeMoney && balance !== null && balance <= 0
      ? [{ text: t("empty"), href: "/wallet" }]
      : []),
    ...(ctx.status !== "active" ? [{ text: t("review"), href: "/onboarding" }] : []),
    ...(ctx.demo ? [{ text: t("expired", { days: 12 }), href: "/profile#documents" }] : []),
  ];
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={ctx.company} />
      {ctx.demo ? <p className="text-sm text-muted-foreground">{t("demo")}</p> : null}
      {blockers.length ? (
        <section
          className={`${card} flex flex-col gap-2 border-warning`}
          aria-labelledby="blockers-h"
        >
          <h2 id="blockers-h" className="font-semibold">
            {t("blockers")}
          </h2>
          <ul className="flex flex-col gap-2">
            {blockers.map((b) => (
              <li key={b.text} className="flex flex-wrap items-center justify-between gap-2">
                <span>{b.text}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={b.href} prefetch={false}>
                    {t("fix")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className={card} data-tour="online">
          <OnlinePanel
            labels={{
              online: t("online"),
              offline: t("offline"),
              onlineHint: t("onlineHint"),
              offlineHint: t("offlineHint"),
              truck: t("truck"),
            }}
            trucks={data.team.map((m) => `${m.truck} · ${m.name}`)}
          />
        </section>
        <section className={`${card} flex flex-col gap-3`} data-tour="offers">
          <LiteMap
            label={t("map")}
            radius={{ center: p.home, miles: 20 }}
            points={[
              { id: "base", kind: "provider", lat: p.home.lat, lng: p.home.lng, label: p.area },
              ...data.offers.map((o) => ({
                id: o.request.id,
                kind: "request" as const,
                tone: "warning" as const,
                lat: o.request.location.lat,
                lng: o.request.location.lng,
                label: o.request.location.area,
              })),
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium" aria-live="polite">
              {t("offers", { count: data.offers.length })}
            </p>
            {data.offers.length ? (
              <Button asChild size="sm">
                <Link href="/offer" prefetch={false}>
                  {t("seeOffer")}
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t("stats.requests")} value={String(data.today.requests)} />
        <StatCard label={t("stats.quotes")} value={String(data.today.quotesSent)} />
        <StatCard label={t("stats.won")} value={String(data.today.jobsWon)} />
        <StatCard label={t("stats.value")} value={money(data.today.jobValueCents)} />
        {ctx.canSeeMoney ? (
          <StatCard label={t("stats.fees")} value={money(data.today.feesCents)} />
        ) : null}
      </div>
      {ctx.canSeeMoney && balance !== null ? (
        <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="text-sm text-muted-foreground">{t("wallet")}</p>
            <p className="text-3xl font-semibold tabular-nums">{money(balance)}</p>
          </div>
          <Button asChild variant={balance < LOW_BALANCE_CENTS ? "default" : "outline"}>
            <Link href="/wallet?topup=1" prefetch={false}>
              {t("topUp")}
            </Link>
          </Button>
          {balance < LOW_BALANCE_CENTS ? (
            <Alert tone="warning" title={t("low")} className="w-full" />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
