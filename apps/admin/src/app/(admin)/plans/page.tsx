import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import {
  assignPlanAction,
  cancelSubscriptionAction,
  saveCatalogAction,
  saveFeaturedAction,
  saveOfferAction,
  setPriceAction,
} from "@/lib/plan-actions";
import { getPlans, parsePriceChange, PLAN_KEYS, previewPriceChange } from "@/lib/plans";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const label = "flex flex-col gap-1.5 text-sm font-medium";
const grid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";
const check = "flex min-h-touch items-center gap-2 text-sm font-medium";
const th = "px-3 py-2 text-left font-medium";
const td = "px-3 py-2";

/**
 * Admin > Business > Plans & pricing (RSOS-114): the plan catalog, prices per market with dated
 * changes (notice or grandfathering, previewed first), Featured slots and rules, first-month
 * offers, assigning a plan, subscribers and the numbers. Owner and Operations manager edit;
 * Finance views. Job fees per service stay in Pricing.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, locale, ctx, sp] = await Promise.all([
    getTranslations("admin.plans"),
    getLocale(),
    getAdminContext(),
    searchParams,
  ]);
  const l = locale as Locale;
  const money = (c: number | null) => (c === null ? "—" : formatCurrency(c, l));
  const day = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(l, { dateStyle: "medium" }).format(new Date(iso)) : "—";
  const data = await getPlans(ctx);
  const canEdit = ctx.role === "super_admin" || ctx.role === "ops_manager";
  const marketName = (id: string | null) =>
    id ? (data.markets.find((m) => m.id === id)?.name ?? id) : t("allMarkets");

  // Price change preview (GET with preview=1): who is affected, from when, before confirming.
  const change = sp.preview === "1" ? parsePriceChange(sp) : null;
  const preview = change && canEdit ? await previewPriceChange(change) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("lead")}{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            {t("feesLink")}
          </Link>
        </p>
      </header>
      {sp.done ? <Alert tone="success" title={t(`done.${sp.done}`)} /> : null}
      {sp.error ? (
        <Alert
          tone="critical"
          title={t(`errors.${["forbidden", "minimum"].includes(sp.error) ? sp.error : "invalid"}`)}
        />
      ) : null}
      {!canEdit ? <Alert tone="info" title={t("viewOnly")} /> : null}

      <section aria-labelledby="sum-h" className={card}>
        <h2 id="sum-h" className="mb-3 font-semibold">
          {t("summary.title")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["mrr", money(data.totals.mrr)],
              ["basic", String(data.totals.basic)],
              ["pro", String(data.totals.pro)],
              ["featured", String(data.totals.featured)],
              ["upgrades", String(data.totals.upgrades30)],
              ["churn", String(data.totals.churn30)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">{t(`summary.${k}`)}</dt>
              <dd className="text-xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">{t("summary.note")}</p>
      </section>

      <section id="catalog" aria-labelledby="cat-h" className="flex flex-col gap-3">
        <h2 id="cat-h" className="text-lg font-semibold">
          {t("catalog.title")}
        </h2>
        <ul className="grid gap-3 lg:grid-cols-3">
          {data.catalog.map((c) => (
            <li key={c.plan} className={card}>
              <form action={saveCatalogAction} className="flex flex-col gap-3">
                <input type="hidden" name="plan" value={c.plan} />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <Badge tone={c.active ? "success" : "neutral"}>
                    {c.active ? t("catalog.shown") : t("catalog.hidden")}
                  </Badge>
                </div>
                <p className="text-sm">
                  {t("catalog.priceNow", { price: money(data.priceNow(c.plan, null)) })}
                </p>
                <fieldset disabled={!canEdit} className="flex flex-col gap-3">
                  <label className={label}>
                    {t("catalog.name")}
                    <input name="name" defaultValue={c.name} className={inputClass} />
                  </label>
                  {c.plan !== "featured" ? (
                    <>
                      <label className={label}>
                        {t("catalog.discount")}
                        <input
                          name="discount"
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          defaultValue={c.fee_discount_bps / 100}
                          className={inputClass}
                        />
                      </label>
                      <label className={label}>
                        {t("catalog.firstLook")}
                        <input
                          name="firstLook"
                          type="number"
                          min={0}
                          max={30}
                          defaultValue={c.first_look_seconds}
                          className={inputClass}
                        />
                      </label>
                      <label className={label}>
                        {t("catalog.techLimit")}
                        <input
                          name="techLimit"
                          type="number"
                          min={1}
                          max={1000}
                          defaultValue={c.technician_limit ?? ""}
                          placeholder={t("catalog.unlimited")}
                          className={inputClass}
                        />
                      </label>
                      <label className={label}>
                        {t("catalog.insights")}
                        <select
                          name="insights"
                          defaultValue={c.insights_level}
                          className={inputClass}
                        >
                          <option value="basic">{t("catalog.insightsBasic")}</option>
                          <option value="full">{t("catalog.insightsFull")}</option>
                        </select>
                      </label>
                      <label className={check}>
                        <input name="autoTopup" type="checkbox" defaultChecked={c.auto_topup} />
                        {t("catalog.autoTopup")}
                      </label>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="discount" value="0" />
                      <input type="hidden" name="firstLook" value="0" />
                      <input type="hidden" name="techLimit" value="" />
                      <input type="hidden" name="insights" value="basic" />
                    </>
                  )}
                  <label className={check}>
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={c.active}
                      disabled={c.plan === "basic"}
                    />
                    {t("catalog.active")}
                  </label>
                  {c.plan === "basic" ? <input type="hidden" name="active" value="on" /> : null}
                  <label className={label}>
                    {t("catalog.order")}
                    <input
                      name="order"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={c.sort_order}
                      className={inputClass}
                    />
                  </label>
                  <label className={label}>
                    {t("catalog.bulletsEn")}
                    <textarea
                      name="bulletsEn"
                      rows={5}
                      defaultValue={c.bullets.en.join("\n")}
                      className={inputClass}
                    />
                  </label>
                  <label className={label}>
                    {t("catalog.bulletsEs")}
                    <textarea
                      name="bulletsEs"
                      rows={5}
                      defaultValue={c.bullets.es.join("\n")}
                      className={inputClass}
                    />
                  </label>
                  {canEdit ? <Button type="submit">{t("save")}</Button> : null}
                </fieldset>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="prices" aria-labelledby="pr-h" className={card}>
        <h2 id="pr-h" className="mb-1 font-semibold">
          {t("prices.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("prices.note")}</p>
        <div
          tabIndex={0}
          role="region"
          aria-label={t("prices.title")}
          className="mb-4 overflow-x-auto rounded-xl border"
        >
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">{t("prices.title")}</caption>
            <thead className="border-b text-muted-foreground">
              <tr>
                <th scope="col" className={th}>
                  {t("market")}
                </th>
                {PLAN_KEYS.map((p) => (
                  <th key={p} scope="col" className={th}>
                    {data.catalog.find((c) => c.plan === p)?.name ?? p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.markets.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className={`${td} text-left font-medium`}>
                    {m.name}
                  </th>
                  {PLAN_KEYS.map((p) => (
                    <td key={p} className={`${td} tabular-nums`}>
                      {money(data.priceNow(p, m.id))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.scheduled.length ? (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">{t("prices.scheduled")}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {data.scheduled.map((s) => (
                <li key={`${s.plan}-${s.market_id}-${s.effective_from}`}>
                  {t("prices.scheduledRow", {
                    plan: s.plan,
                    market: marketName(s.market_id),
                    price: money(s.price_cents),
                    date: day(s.effective_from),
                  })}
                  {s.grandfather ? ` · ${t("prices.grandfathered")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {canEdit ? (
          <form method="get" action="/plans#prices" className="flex flex-col gap-3">
            <input type="hidden" name="preview" value="1" />
            <h3 className="text-sm font-semibold">{t("prices.changeTitle")}</h3>
            <div className={grid}>
              <label className={label}>
                {t("prices.plan")}
                <select name="plan" defaultValue={sp.plan ?? "pro"} className={inputClass}>
                  {PLAN_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {data.catalog.find((c) => c.plan === p)?.name ?? p}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("market")}
                <select name="market" defaultValue={sp.market ?? ""} className={inputClass}>
                  <option value="">{t("allMarkets")}</option>
                  {data.markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("prices.newPrice")}
                <input
                  name="price"
                  type="number"
                  min={1}
                  max={1000}
                  step={0.01}
                  required
                  defaultValue={sp.price ?? ""}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("prices.from")}
                <input
                  name="from"
                  type="date"
                  min={today}
                  required
                  defaultValue={sp.from ?? today}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("prices.existing")}
                <select name="existing" defaultValue={sp.existing ?? "next"} className={inputClass}>
                  <option value="next">{t("prices.existingNext")}</option>
                  <option value="grandfather">{t("prices.existingKeep")}</option>
                </select>
              </label>
              <label className={label}>
                {t("prices.notice")}
                <input
                  name="notice"
                  type="number"
                  min={0}
                  max={365}
                  defaultValue={sp.notice ?? "30"}
                  className={inputClass}
                />
              </label>
            </div>
            <div>
              <Button type="submit" variant="outline">
                {t("prices.preview")}
              </Button>
            </div>
          </form>
        ) : null}
        {sp.preview === "1" && !change ? (
          <Alert tone="critical" title={t("errors.invalid")} />
        ) : null}
        {preview && change ? (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4" aria-live="polite">
            <h3 className="font-semibold">{t("prices.previewTitle")}</h3>
            {preview.error ? (
              <Alert
                tone="critical"
                title={
                  /at least 20/.test(preview.error) ? t("errors.minimum") : t("errors.invalid")
                }
              />
            ) : (
              <>
                <p className="text-sm">
                  {t("prices.previewLead", {
                    count: preview.rows.length,
                    price: money(change.priceCents),
                    date: day(change.effectiveFrom),
                  })}
                </p>
                {preview.rows.length ? (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label={t("prices.previewTitle")}
                    className="overflow-x-auto rounded-xl border"
                  >
                    <table className="w-full min-w-[32rem] text-sm">
                      <caption className="sr-only">{t("prices.previewTitle")}</caption>
                      <thead className="border-b text-muted-foreground">
                        <tr>
                          <th scope="col" className={th}>
                            {t("provider")}
                          </th>
                          <th scope="col" className={th}>
                            {t("prices.pays")}
                          </th>
                          <th scope="col" className={th}>
                            {t("prices.willPay")}
                          </th>
                          <th scope="col" className={th}>
                            {t("prices.appliesFrom")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.rows.map((r) => (
                          <tr key={r.subscription_id}>
                            <th scope="row" className={`${td} text-left font-medium`}>
                              {r.provider_name}
                            </th>
                            <td className={`${td} tabular-nums`}>{money(r.current_cents)}</td>
                            <td className={`${td} tabular-nums`}>{money(r.new_cents)}</td>
                            <td className={td}>
                              {r.grandfathered ? t("prices.grandfathered") : day(r.applies_from)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {!change.grandfather && preview.rows.length ? (
                  <div className="rounded-xl border bg-muted p-3 text-sm">
                    <p className="font-medium">{t("prices.emailTitle")}</p>
                    <p className="text-muted-foreground">
                      {t("prices.emailBody", {
                        days: change.noticeDays,
                      })}
                    </p>
                  </div>
                ) : null}
                <form action={setPriceAction}>
                  {(["plan", "market", "price", "from", "existing", "notice"] as const).map((k) => (
                    <input key={k} type="hidden" name={k} value={sp[k] ?? ""} />
                  ))}
                  <Button type="submit">{t("prices.confirm")}</Button>
                </form>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section id="featured" aria-labelledby="ft-h" className="flex flex-col gap-3">
        <h2 id="ft-h" className="text-lg font-semibold">
          {t("featured.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("featured.note")}</p>
        <ul className="grid gap-3 lg:grid-cols-3">
          {data.featured.map((f) => (
            <li key={f.market.id} className={card}>
              <form action={saveFeaturedAction} className="flex flex-col gap-3">
                <input type="hidden" name="market" value={f.market.id} />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{f.market.name}</h3>
                  <Badge tone={f.taken >= f.slots ? "warning" : "success"}>
                    {t("featured.fill", { taken: f.taken, slots: f.slots })}
                  </Badge>
                </div>
                {f.waitlist ? (
                  <p className="text-sm">{t("featured.waitlist", { count: f.waitlist })}</p>
                ) : null}
                <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    {t("featured.slots")}
                    <input
                      name="slots"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={f.slots}
                      className={inputClass}
                    />
                  </label>
                  <label className={label}>
                    {t("featured.pct")}
                    <input
                      name="pct"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={f.priceRulePct}
                      className={inputClass}
                    />
                  </label>
                  <label className={label}>
                    {t("featured.eta")}
                    <input
                      name="eta"
                      type="number"
                      min={0}
                      max={60}
                      defaultValue={f.etaRuleMinutes}
                      className={inputClass}
                    />
                  </label>
                  <label className={check}>
                    <input name="service" type="checkbox" defaultChecked={f.serviceSlots} />
                    {t("featured.service")}
                  </label>
                  {canEdit ? (
                    <div className="sm:col-span-2">
                      <Button type="submit" variant="outline">
                        {t("save")}
                      </Button>
                    </div>
                  ) : null}
                </fieldset>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="offers" aria-labelledby="of-h" className={card}>
        <h2 id="of-h" className="mb-1 font-semibold">
          {t("offers.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("offers.note")}</p>
        <ul className="flex flex-col gap-3">
          {data.markets.flatMap((m) =>
            (["basic", "pro"] as const).map((plan) => {
              const o = data.offers.find((x) => x.market_id === m.id && x.plan === plan);
              return (
                <li key={`${m.id}-${plan}`}>
                  <form
                    action={saveOfferAction}
                    className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
                  >
                    <input type="hidden" name="market" value={m.id} />
                    <input type="hidden" name="plan" value={plan} />
                    <p className="text-sm font-medium lg:self-center">
                      {t("offers.row", {
                        market: m.name,
                        plan: data.catalog.find((c) => c.plan === plan)?.name ?? plan,
                      })}
                    </p>
                    <fieldset disabled={!canEdit} className="contents">
                      <label className={label}>
                        {t("offers.price")}
                        <input
                          name="price"
                          type="number"
                          min={0}
                          max={1000}
                          step={0.01}
                          defaultValue={o ? o.first_month_cents / 100 : 0}
                          className={inputClass}
                        />
                      </label>
                      <label className={label}>
                        {t("offers.ends")}
                        <input
                          name="ends"
                          type="date"
                          required
                          defaultValue={o ? o.ends_at.slice(0, 10) : today}
                          className={inputClass}
                        />
                      </label>
                      <label className={check}>
                        <input name="active" type="checkbox" defaultChecked={o?.active ?? false} />
                        {t("offers.active")}
                      </label>
                      {canEdit ? (
                        <Button type="submit" variant="outline">
                          {t("save")}
                        </Button>
                      ) : null}
                    </fieldset>
                  </form>
                </li>
              );
            }),
          )}
        </ul>
      </section>

      {canEdit ? (
        <section id="assign" aria-labelledby="as-h" className={card}>
          <h2 id="as-h" className="mb-1 font-semibold">
            {t("assign.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("assign.note")}</p>
          {data.providersWithoutPlan.length ? (
            <form action={assignPlanAction} className="grid items-end gap-3 sm:grid-cols-3">
              <label className={label}>
                {t("provider")}
                <select name="provider" required className={inputClass}>
                  {data.providersWithoutPlan.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("prices.plan")}
                <select name="plan" defaultValue="basic" className={inputClass}>
                  <option value="basic">
                    {data.catalog.find((c) => c.plan === "basic")?.name}
                  </option>
                  <option value="pro">{data.catalog.find((c) => c.plan === "pro")?.name}</option>
                </select>
              </label>
              <Button type="submit" variant="outline">
                {t("assign.button")}
              </Button>
            </form>
          ) : (
            <p className="text-sm">{t("assign.none")}</p>
          )}
        </section>
      ) : null}

      <section id="subscribers" aria-labelledby="sb-h" className={card}>
        <h2 id="sb-h" className="mb-3 font-semibold">
          {t("subscribers.title")}
        </h2>
        {data.subscribers.length === 0 ? (
          <p className="text-sm">{t("subscribers.none")}</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label={t("subscribers.title")}
            className="overflow-x-auto rounded-xl border"
          >
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">{t("subscribers.title")}</caption>
              <thead className="border-b text-muted-foreground">
                <tr>
                  {(
                    ["provider", "plan", "market", "since", "paid", "status", "actions"] as const
                  ).map((k) => (
                    <th key={k} scope="col" className={th}>
                      {k === "provider"
                        ? t("provider")
                        : k === "market"
                          ? t("market")
                          : t(`subscribers.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.subscribers.map((s) => (
                  <tr key={s.subscription_id}>
                    <th scope="row" className={`${td} text-left font-medium`}>
                      <Link
                        href={`/providers/${s.provider_id}`}
                        className="inline-flex min-h-touch items-center underline-offset-2 hover:underline"
                      >
                        {s.provider_name}
                      </Link>
                    </th>
                    <td className={td}>
                      {data.catalog.find((c) => c.plan === s.plan)?.name ?? s.plan}
                    </td>
                    <td className={td}>{s.market_name}</td>
                    <td className={td}>{day(s.started_at)}</td>
                    <td className={`${td} tabular-nums`}>
                      {money(s.price_cents)}
                      {s.grandfathered ? ` · ${t("prices.grandfathered")}` : ""}
                    </td>
                    <td className={td}>
                      {s.status === "waitlist"
                        ? t("subscribers.waitlist")
                        : s.cancel_at_period_end
                          ? t("subscribers.ends", { date: day(s.current_period_end) })
                          : s.next_plan
                            ? t("subscribers.downgrade", { date: day(s.current_period_end) })
                            : s.next_price_cents
                              ? t("subscribers.nextPrice", {
                                  price: money(s.next_price_cents),
                                  date: day(s.next_price_from),
                                })
                              : t("subscribers.active")}
                    </td>
                    <td className={td}>
                      {canEdit && !s.cancel_at_period_end ? (
                        <form action={cancelSubscriptionAction}>
                          <input type="hidden" name="subscription" value={s.subscription_id} />
                          <Button type="submit" variant="outline">
                            {t("subscribers.cancel")}
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
