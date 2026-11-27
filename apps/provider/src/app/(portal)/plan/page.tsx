import { discountedFee } from "@rsos/core/plans";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { getPlanPage } from "@/lib/plan";
import { cancelPlanAction, joinFeaturedAction, startPlanAction } from "@/lib/plan-actions";
import { getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";

/**
 * Plan & billing (RSOS-114): the current plan and what it includes, this month's fees and savings,
 * the personal Pro break-even line, upgrade, switch and cancel, Featured per market with the
 * waitlist, and the fee per service. Prices come from the admin catalog. Billing is simulated
 * until Stripe (batch 6); checkout is behind the planCheckout flag.
 */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, locale, ctx, sp] = await Promise.all([
    getTranslations("portal.plan"),
    getLocale(),
    getPortalContext(),
    searchParams,
  ]);
  const l = locale as Locale;
  const lang = l === "es" ? "es" : "en";
  const money = (c: number | null | undefined) => (c == null ? "—" : formatCurrency(c, l));
  const day = (iso: string | null | undefined) =>
    iso ? new Intl.DateTimeFormat(l, { dateStyle: "long" }).format(new Date(iso)) : "—";
  const data = await getPlanPage(ctx);
  const current = data.base?.plan ?? null;
  const planName = (key: string) => data.plans.find((p) => p.plan === key)?.name ?? key;
  const choices = data.plans.filter((p) => p.plan !== "featured");
  const featuredPlan = data.plans.find((p) => p.plan === "featured");
  const pro = data.plans.find((p) => p.plan === "pro");
  const canAct = data.checkout && ctx.role !== "operator";

  return (
    <main id="main" className={pageMain}>
      <PageHead
        title={t("title")}
        subtitle={data.marketName ? t("subtitle", { market: data.marketName }) : undefined}
      />
      {sp.done ? <Alert tone="success" title={t(`done.${sp.done}`)} /> : null}
      {sp.error ? (
        <Alert
          tone="critical"
          title={t(`errors.${["closed", "forbidden"].includes(sp.error) ? sp.error : "invalid"}`)}
        />
      ) : null}
      {!data.checkout ? <Alert tone="info" title={t("checkoutSoon")} /> : null}

      <section id="current" aria-labelledby="cur-h" className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="cur-h" className="text-lg font-semibold">
            {t("current.title")}
          </h2>
          {current ? (
            <Badge tone={current === "pro" ? "success" : "info"}>{planName(current)}</Badge>
          ) : (
            <Badge tone="warning">{t("current.none")}</Badge>
          )}
        </div>
        {data.base ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {t("perMonth", { price: money(data.base.price_cents) })}
            </p>
            <p>
              {data.base.cancel_at_period_end
                ? t("current.ends", { date: day(data.base.current_period_end) })
                : data.base.next_plan
                  ? t("current.downgrade", {
                      plan: planName(data.base.next_plan),
                      date: day(data.base.current_period_end),
                    })
                  : t("current.renews", { date: day(data.base.current_period_end) })}
            </p>
            {data.base.next_price_cents && data.base.next_price_from ? (
              <p>
                {t("current.nextPrice", {
                  price: money(data.base.next_price_cents),
                  date: day(data.base.next_price_from),
                })}
              </p>
            ) : null}
            {canAct && !data.base.cancel_at_period_end ? (
              <form action={cancelPlanAction} className="mt-2">
                <input type="hidden" name="subscription" value={data.base.id} />
                <Button type="submit" variant="outline">
                  {t("current.cancel")}
                </Button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-sm">{t("current.noPlanBody")}</p>
        )}
      </section>

      {ctx.canSeeMoney ? (
        <section aria-labelledby="month-h" className={card}>
          <h2 id="month-h" className="mb-2 text-lg font-semibold">
            {t("month.title")}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t("month.jobs")}</dt>
              <dd className="text-xl font-semibold tabular-nums">{data.month.jobs}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t("month.fees")}</dt>
              <dd className="text-xl font-semibold tabular-nums">{money(data.month.feesCents)}</dd>
            </div>
            {current === "pro" ? (
              <div>
                <dt className="text-sm text-muted-foreground">{t("month.saved")}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {money(data.month.savedCents)}
                </dd>
              </div>
            ) : null}
          </dl>
          {data.breakEven !== null && pro ? (
            <p className="mt-3 text-sm">{t("month.breakEven", { jobs: data.breakEven })}</p>
          ) : null}
          {current !== "pro" && data.month.proWouldSave !== null && data.month.jobs > 0 ? (
            <p className="mt-1 text-sm">
              {data.month.proWouldSave > 0
                ? t("month.wouldSave", {
                    jobs: data.month.jobs,
                    amount: money(data.month.proWouldSave),
                  })
                : t("month.notYet", { jobs: data.month.jobs })}
            </p>
          ) : null}
        </section>
      ) : null}

      <section id="plans" aria-labelledby="plans-h" className="flex flex-col gap-3">
        <h2 id="plans-h" className="text-lg font-semibold">
          {t("plans.title")}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {choices.map((p) => (
            <li key={p.plan} className={`${card} flex flex-col gap-3`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {p.plan === current ? <Badge tone="success">{t("plans.yours")}</Badge> : null}
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {t("perMonth", { price: money(p.price_cents) })}
              </p>
              {p.offer_cents != null && p.offer_ends_at ? (
                <p className="text-sm font-medium">
                  {t("plans.offer", { price: money(p.offer_cents), date: day(p.offer_ends_at) })}
                </p>
              ) : null}
              <ul className="flex flex-col gap-2 text-sm">
                {p.bullets[lang].map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                    {b}
                  </li>
                ))}
              </ul>
              {canAct && p.plan !== current ? (
                <form action={startPlanAction} className="mt-auto">
                  <input type="hidden" name="plan" value={p.plan} />
                  <Button type="submit" className="w-full">
                    {current === null
                      ? t("plans.start", { plan: p.name })
                      : p.plan === "pro"
                        ? t("plans.upgrade")
                        : t("plans.switch", { plan: p.name })}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("plans.rules")}</p>
      </section>

      {featuredPlan ? (
        <section id="featured" aria-labelledby="ft-h" className={card}>
          <h2 id="ft-h" className="mb-1 text-lg font-semibold">
            {featuredPlan.name}
          </h2>
          <ul className="mb-3 flex flex-col gap-2 text-sm">
            {featuredPlan.bullets[lang].map((b) => (
              <li key={b} className="flex gap-2">
                <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
                {b}
              </li>
            ))}
          </ul>
          <ul className="flex flex-col divide-y rounded-xl border">
            {data.featuredByMarket.map((m) => {
              const mine = data.featured.find((f) => f.market_id === m.marketId);
              const full = m.taken >= m.slots;
              return (
                <li
                  key={m.marketId}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-muted-foreground">
                      {t("featured.line", {
                        price: money(m.price),
                        left: Math.max(0, m.slots - m.taken),
                        slots: m.slots,
                      })}
                    </p>
                  </div>
                  {mine ? (
                    <Badge tone={mine.status === "active" ? "success" : "info"}>
                      {mine.status === "active" ? t("featured.active") : t("featured.waiting")}
                    </Badge>
                  ) : canAct && current ? (
                    <form action={joinFeaturedAction}>
                      <input type="hidden" name="market" value={m.marketId} />
                      <Button type="submit" variant="outline">
                        {full ? t("featured.waitlist") : t("featured.join")}
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {!current ? <p className="mt-2 text-sm">{t("featured.needPlan")}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">{t("featured.disclosure")}</p>
        </section>
      ) : null}

      {data.fees.length ? (
        <section aria-labelledby="fees-h" className={card}>
          <h2 id="fees-h" className="mb-2 text-lg font-semibold">
            {t("fees.title")}
          </h2>
          <div
            tabIndex={0}
            role="region"
            aria-label={t("fees.title")}
            className="overflow-x-auto rounded-xl border"
          >
            <table className="w-full min-w-[20rem] text-sm">
              <caption className="sr-only">{t("fees.title")}</caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {t("fees.service")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {planName("basic")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    {planName("pro")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.fees.map((f) => (
                  <tr key={f.service_slug}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {f.service_name}
                    </th>
                    <td className="px-3 py-2 tabular-nums">{money(f.platform_fee_cents)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {money(discountedFee(f.platform_fee_cents ?? 0, data.discount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("fees.when")}</p>
        </section>
      ) : null}
    </main>
  );
}
