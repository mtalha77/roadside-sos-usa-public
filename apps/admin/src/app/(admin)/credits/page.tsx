import { canGrant, campaignPlan, GRANT_REASONS, type Limits } from "@rsos/core/wallet";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import {
  grantCreditAction,
  reverseCreditAction,
  reviewFlagAction,
  runCampaignAction,
  setLimitAction,
  setRuleAction,
  setSignupBonusAction,
} from "@/lib/credit-actions";
import { getCredits, previewCampaign } from "@/lib/credits";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const label = "flex flex-col gap-1.5 text-sm font-medium";
const row = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4";

const Preview = z.object({
  preview: z.literal("1"),
  name: z.string().trim().min(3).max(80),
  market: z.uuid(),
  audience: z.enum(["market", "service", "inactive", "list"]),
  service: z.string().optional(),
  list: z.string().max(5000).optional(),
  amount: z.coerce.number().min(1).max(1000),
  expiry: z.coerce.number().int().min(1).max(365),
  message: z.string().max(300).optional(),
  budget: z.coerce.number().min(1).max(100_000),
  plan: z.string().optional(),
});

/**
 * Admin > Business > Wallet credits (RSOS-115): signup bonus per market, manual grants, bulk
 * campaigns with a preview and a budget cap, optional rule-based bonuses, approval limits, duplicate
 * business reviews, recent grants (with reversal by the owner) and the campaign report.
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, locale, ctx, sp] = await Promise.all([
    getTranslations("admin.credits"),
    getLocale(),
    getAdminContext(),
    searchParams,
  ]);
  const data = await getCredits(ctx);
  const now = await demoNow();
  const l = locale as Locale;
  const money = (c: number) => formatCurrency(c, l);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
  });
  const canEdit = ctx.role === "super_admin" || ctx.role === "ops_manager";
  const owner = ctx.role === "super_admin";
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const marketName = (id: string | null) => ctx.markets.find((m) => m.id === id)?.name ?? "–";
  const limits: Record<string, Limits> = Object.fromEntries(
    data.limits.map((x) => [
      x.role,
      { perGrantCents: x.per_grant_cents, perCampaignCents: x.per_campaign_cents },
    ]),
  );
  const opsLimit = limits.ops_manager;

  // Campaign preview: who receives it and the total cost, before confirming.
  const pv = Preview.safeParse(sp);
  const listIds = pv.success
    ? (pv.data.list ?? "")
        .split(/\n|,/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .flatMap((n) =>
          data.providers.filter((p) => p.name.toLowerCase() === n || p.id === n).map((p) => p.id),
        )
    : [];
  const recipients = pv.success
    ? await previewCampaign({
        market: pv.data.market,
        audience: pv.data.audience,
        service: pv.data.service,
        list: listIds,
      })
    : [];
  const plan = pv.success
    ? campaignPlan(
        recipients.map((r) => ({ id: r.provider_id, name: r.name })),
        Math.round(pv.data.amount * 100),
        Math.round(pv.data.budget * 100),
      )
    : null;
  const previewCheck = pv.success
    ? canGrant(ctx.role, "campaign", Math.round(pv.data.budget * 100), limits)
    : null;

  const done = sp.done ? t(`done.${sp.done}` as never) : null;
  const error = sp.error
    ? t(`errors.${sp.error === "limit" || sp.error === "forbidden" ? sp.error : "invalid"}`)
    : null;

  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      {done ? <Alert tone="success" title={done} /> : null}
      {error ? <Alert tone="critical" title={error} /> : null}
      {!canEdit ? <Alert tone="info" title={t("viewOnly")} /> : null}

      <section id="signup" className={card} aria-labelledby="signup-h">
        <h2 id="signup-h" className="mb-1 font-semibold">
          {t("signup.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("signup.note")}</p>
        <ul className="flex flex-col gap-3">
          {markets.map((m) => {
            const r = data.rules.get(m.id);
            return (
              <li key={m.id}>
                <form
                  action={setSignupBonusAction}
                  className="flex flex-col gap-3 rounded-xl border p-3"
                >
                  <input type="hidden" name="market" value={m.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <Badge tone={r?.enabled ? "success" : "neutral"}>
                      {r?.enabled ? t("on") : t("off")}
                    </Badge>
                  </div>
                  <div className={row}>
                    <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={r?.enabled ?? false}
                        className="size-5"
                        disabled={!canEdit}
                      />
                      {t("signup.enabled")}
                    </label>
                    <label className={label}>
                      {t("amountUsd")}
                      <input
                        name="amount"
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        required
                        defaultValue={(r?.amount_cents ?? 5000) / 100}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </label>
                    <label className={label}>
                      {t("expiryDays")}
                      <input
                        name="expiry"
                        type="number"
                        min="1"
                        max="365"
                        required
                        defaultValue={r?.expiry_days ?? 60}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={label}>
                        {t("starts")}
                        <input
                          name="starts"
                          type="date"
                          defaultValue={r?.starts_on ?? ""}
                          className={inputClass}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className={label}>
                        {t("ends")}
                        <input
                          name="ends"
                          type="date"
                          defaultValue={r?.ends_on ?? ""}
                          className={inputClass}
                          disabled={!canEdit}
                        />
                      </label>
                    </div>
                  </div>
                  {canEdit ? (
                    <Button type="submit" variant="outline" className="self-start">
                      {t("signup.save", { market: m.name })}
                    </Button>
                  ) : null}
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {canEdit ? (
        <section id="grant" className={card} aria-labelledby="grant-h">
          <h2 id="grant-h" className="mb-1 font-semibold">
            {t("grant.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {owner
              ? t("grant.noteOwner")
              : t("grant.noteLimit", {
                  limit: opsLimit?.perGrantCents == null ? "–" : money(opsLimit.perGrantCents),
                })}
          </p>
          <form action={grantCreditAction} className="flex flex-col gap-3">
            <div className={row}>
              <label className={`${label} sm:col-span-2`}>
                {t("provider")}
                <select name="provider" required className={inputClass} defaultValue="">
                  <option value="" disabled>
                    {t("choose")}
                  </option>
                  {data.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("amountUsd")}
                <input
                  name="amount"
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  required
                  defaultValue="25"
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("expiryDays")}
                <input
                  name="expiry"
                  type="number"
                  min="1"
                  max="365"
                  required
                  defaultValue="60"
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("reason")}
                <select name="reason" required className={inputClass} defaultValue="goodwill">
                  {GRANT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`reasons.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2 lg:col-span-3`}>
                {t("noteLabel")}
                <input name="note" maxLength={300} className={inputClass} />
              </label>
            </div>
            <Button type="submit" className="self-start">
              {t("grant.submit")}
            </Button>
          </form>
        </section>
      ) : null}

      {canEdit ? (
        <section id="campaign" className={card} aria-labelledby="campaign-h">
          <h2 id="campaign-h" className="mb-1 font-semibold">
            {t("campaign.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {owner
              ? t("campaign.noteOwner")
              : t("campaign.noteLimit", {
                  limit:
                    opsLimit?.perCampaignCents == null ? "–" : money(opsLimit.perCampaignCents),
                })}
          </p>
          <form method="get" action="/credits#campaign" className="flex flex-col gap-3">
            <input type="hidden" name="preview" value="1" />
            <div className={row}>
              <label className={`${label} sm:col-span-2`}>
                {t("campaign.name")}
                <input
                  name="name"
                  required
                  minLength={3}
                  maxLength={80}
                  defaultValue={pv.success ? pv.data.name : ""}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("market")}
                <select
                  name="market"
                  required
                  className={inputClass}
                  defaultValue={pv.success ? pv.data.market : markets[0]?.id}
                >
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("campaign.audience")}
                <select
                  name="audience"
                  className={inputClass}
                  defaultValue={pv.success ? pv.data.audience : "market"}
                >
                  {(["market", "service", "inactive", "list"] as const).map((a) => (
                    <option key={a} value={a}>
                      {t(`campaign.audiences.${a}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                {t("campaign.service")}
                <select
                  name="service"
                  className={inputClass}
                  defaultValue={pv.success ? pv.data.service : ""}
                >
                  <option value="">{t("campaign.anyService")}</option>
                  {data.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2 lg:col-span-3`}>
                {t("campaign.list")}
                <textarea
                  name="list"
                  rows={2}
                  maxLength={5000}
                  defaultValue={pv.success ? pv.data.list : ""}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("amountUsd")}
                <input
                  name="amount"
                  type="number"
                  min="1"
                  max="1000"
                  required
                  defaultValue={pv.success ? pv.data.amount : 20}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("expiryDays")}
                <input
                  name="expiry"
                  type="number"
                  min="1"
                  max="365"
                  required
                  defaultValue={pv.success ? pv.data.expiry : 60}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                {t("campaign.budget")}
                <input
                  name="budget"
                  type="number"
                  min="1"
                  max="100000"
                  required
                  defaultValue={pv.success ? pv.data.budget : 500}
                  className={inputClass}
                />
              </label>
              <label className={`${label} sm:col-span-2 lg:col-span-3`}>
                {t("campaign.message")}
                <input
                  name="message"
                  maxLength={300}
                  defaultValue={pv.success ? pv.data.message : ""}
                  className={inputClass}
                />
              </label>
              {owner ? (
                <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="plan"
                    defaultChecked={pv.success && pv.data.plan === "on"}
                    className="size-5"
                  />
                  {t("campaign.plan")}
                </label>
              ) : null}
            </div>
            <Button type="submit" variant="outline" className="self-start">
              {t("campaign.preview")}
            </Button>
          </form>

          {pv.success && plan ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border p-3" aria-live="polite">
              <h3 className="font-semibold">{t("campaign.previewTitle")}</h3>
              <p className="text-sm">
                {t("campaign.summary", {
                  count: plan.granted.length,
                  amount: money(Math.round(pv.data.amount * 100)),
                  total: money(plan.totalCents),
                  budget: money(Math.round(pv.data.budget * 100)),
                })}
              </p>
              {plan.leftOut.length ? (
                <p className="text-sm text-warning-strong">
                  {t("campaign.leftOut", { count: plan.leftOut.length })}
                </p>
              ) : null}
              {previewCheck === "needs_owner" ? (
                <Alert tone="warning" title={t("errors.limit")} />
              ) : null}
              {plan.granted.length ? (
                <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm">
                  {plan.granted.map((r) => (
                    <li key={r.id} className="flex justify-between px-3 py-2">
                      <span>{r.name}</span>
                      <span className="tabular-nums">
                        {money(Math.round(pv.data.amount * 100))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("campaign.nobody")}</p>
              )}
              {plan.granted.length && previewCheck === "ok" ? (
                <form action={runCampaignAction}>
                  {(
                    [
                      ["name", pv.data.name],
                      ["market", pv.data.market],
                      ["audience", pv.data.audience],
                      ["service", pv.data.service ?? ""],
                      ["amount", String(pv.data.amount)],
                      ["expiry", String(pv.data.expiry)],
                      ["budget", String(pv.data.budget)],
                      ["message", pv.data.message ?? ""],
                      ["plan", pv.data.plan === "on" ? "on" : ""],
                    ] as const
                  ).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                  {listIds.map((id) => (
                    <input key={id} type="hidden" name="list" value={id} />
                  ))}
                  <Button type="submit">
                    {t("campaign.confirm", { total: money(plan.totalCents) })}
                  </Button>
                </form>
              ) : null}
            </div>
          ) : sp.preview ? (
            <Alert tone="critical" title={t("errors.invalid")} />
          ) : null}
        </section>
      ) : null}

      <section id="rules" className={card} aria-labelledby="rules-h">
        <h2 id="rules-h" className="mb-1 font-semibold">
          {t("rules.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("rules.note")}</p>
        <ul className="flex flex-col gap-3">
          {markets.flatMap((m) =>
            (["milestone", "referral", "reactivation"] as const).map((kind) => {
              const r = data.creditRules.find((x) => x.market_id === m.id && x.kind === kind);
              return (
                <li key={`${m.id}-${kind}`}>
                  <form
                    action={setRuleAction}
                    className="flex flex-col gap-3 rounded-xl border p-3"
                  >
                    <input type="hidden" name="market" value={m.id} />
                    <input type="hidden" name="kind" value={kind} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        {m.name} · {t(`rules.kinds.${kind}`)}
                      </h3>
                      <Badge tone={r?.enabled ? "success" : "neutral"}>
                        {r?.enabled ? t("on") : t("off")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{t(`rules.hints.${kind}`)}</p>
                    <div className={row}>
                      <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={r?.enabled ?? false}
                          className="size-5"
                          disabled={!canEdit}
                        />
                        {t("rules.enabled")}
                      </label>
                      <label className={label}>
                        {t("amountUsd")}
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          max="1000"
                          required
                          defaultValue={(r?.amount_cents ?? 2000) / 100}
                          className={inputClass}
                          disabled={!canEdit}
                        />
                      </label>
                      {kind === "milestone" ? (
                        <label className={label}>
                          {t("rules.threshold")}
                          <input
                            name="threshold"
                            type="number"
                            min="1"
                            max="1000"
                            defaultValue={r?.threshold ?? 10}
                            className={inputClass}
                            disabled={!canEdit}
                          />
                        </label>
                      ) : (
                        <input
                          type="hidden"
                          name="threshold"
                          value={kind === "referral" ? 3 : 30}
                        />
                      )}
                      <label className={label}>
                        {t("expiryDays")}
                        <input
                          name="expiry"
                          type="number"
                          min="1"
                          max="365"
                          required
                          defaultValue={r?.expiry_days ?? 60}
                          className={inputClass}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className={label}>
                        {t("rules.budget", { used: money(r?.used_cents ?? 0) })}
                        <input
                          name="budget"
                          type="number"
                          min="0"
                          max="100000"
                          required
                          defaultValue={(r?.budget_cents ?? 50000) / 100}
                          className={inputClass}
                          disabled={!canEdit}
                        />
                      </label>
                    </div>
                    {canEdit ? (
                      <Button type="submit" variant="outline" className="self-start">
                        {t("rules.save")}
                      </Button>
                    ) : null}
                  </form>
                </li>
              );
            }),
          )}
        </ul>
      </section>

      <section id="limits" className={card} aria-labelledby="limits-h">
        <h2 id="limits-h" className="mb-1 font-semibold">
          {t("limits.title")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("limits.note")}</p>
        <form action={setLimitAction} className="flex flex-col gap-3">
          <input type="hidden" name="role" value="ops_manager" />
          <div className={row}>
            <label className={label}>
              {t("limits.perGrant")}
              <input
                name="grant"
                type="number"
                min="0"
                max="1000000"
                defaultValue={opsLimit?.perGrantCents == null ? "" : opsLimit.perGrantCents / 100}
                className={inputClass}
                disabled={!owner}
              />
            </label>
            <label className={label}>
              {t("limits.perCampaign")}
              <input
                name="campaign"
                type="number"
                min="0"
                max="1000000"
                defaultValue={
                  opsLimit?.perCampaignCents == null ? "" : opsLimit.perCampaignCents / 100
                }
                className={inputClass}
                disabled={!owner}
              />
            </label>
          </div>
          {owner ? (
            <Button type="submit" variant="outline" className="self-start">
              {t("limits.save")}
            </Button>
          ) : null}
        </form>
      </section>

      {data.flags.length ? (
        <section id="flags" className={card} aria-labelledby="flags-h">
          <h2 id="flags-h" className="mb-1 font-semibold">
            {t("flags.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("flags.note")}</p>
          <ul className="divide-y">
            {data.flags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {data.name(f.provider_id)} · {date.format(Date.parse(f.created_at))}
                </span>
                {canEdit ? (
                  <span className="flex gap-2">
                    <form action={reviewFlagAction}>
                      <input type="hidden" name="flag" value={f.id} />
                      <input type="hidden" name="grant" value="yes" />
                      <Button type="submit" variant="outline">
                        {t("flags.grant")}
                      </Button>
                    </form>
                    <form action={reviewFlagAction}>
                      <input type="hidden" name="flag" value={f.id} />
                      <input type="hidden" name="grant" value="no" />
                      <Button type="submit" variant="outline">
                        {t("flags.keep")}
                      </Button>
                    </form>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="grants" className={card} aria-labelledby="grants-h">
        <h2 id="grants-h" className="mb-3 font-semibold">
          {t("recent.title")}
        </h2>
        {data.grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("recent.empty")}</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label={t("recent.title")}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{t("recent.title")}</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  {(
                    [
                      "date",
                      "provider",
                      "market",
                      "source",
                      "amount",
                      "left",
                      "expires",
                      "action",
                    ] as const
                  ).map((k) => (
                    <th key={k} scope="col" className="py-2 pr-3 font-medium">
                      {t(`recent.cols.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.grants.map((g) => (
                  <tr key={g.id}>
                    <td className="py-2 pr-3">{date.format(Date.parse(g.created_at))}</td>
                    <td className="py-2 pr-3">{data.name(g.provider_id)}</td>
                    <td className="py-2 pr-3">{marketName(g.market_id)}</td>
                    <td className="py-2 pr-3">
                      {t(`sources.${g.source}` as never)}
                      {g.reason ? ` · ${t(`reasons.${g.reason}` as never)}` : ""}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{money(g.amount_cents)}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {g.reversed_at ? t("recent.reversed") : money(g.remaining_cents)}
                    </td>
                    <td className="py-2 pr-3">{date.format(Date.parse(g.expires_at))}</td>
                    <td className="py-2 pr-3">
                      {owner &&
                      !g.reversed_at &&
                      g.remaining_cents > 0 &&
                      Date.parse(g.expires_at) > now ? (
                        <form action={reverseCreditAction} className="flex items-center gap-2">
                          <input type="hidden" name="grant" value={g.id} />
                          <label className="sr-only" htmlFor={`why-${g.id}`}>
                            {t("recent.why")}
                          </label>
                          <input
                            id={`why-${g.id}`}
                            name="reason"
                            required
                            minLength={3}
                            maxLength={300}
                            placeholder={t("recent.why")}
                            className={`${inputClass} w-36`}
                          />
                          <Button type="submit" variant="outline">
                            {t("recent.reverse")}
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

      <section id="report" className={card} aria-labelledby="report-h">
        <h2 id="report-h" className="mb-3 font-semibold">
          {t("report.title")}
        </h2>
        {data.report.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("report.empty")}</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label={t("report.title")}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">{t("report.title")}</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  {(
                    [
                      "name",
                      "market",
                      "granted",
                      "used",
                      "expired",
                      "recipients",
                      "toppedUp",
                      "jobs",
                      "revenue",
                    ] as const
                  ).map((k) => (
                    <th key={k} scope="col" className="py-2 pr-3 font-medium">
                      {t(`report.cols.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.report.map((c) => (
                  <tr key={c.campaign_id}>
                    <td className="py-2 pr-3">{c.name}</td>
                    <td className="py-2 pr-3">{marketName(c.market_id)}</td>
                    <td className="py-2 pr-3 tabular-nums">{money(c.granted_cents)}</td>
                    <td className="py-2 pr-3 tabular-nums">{money(c.used_cents)}</td>
                    <td className="py-2 pr-3 tabular-nums">{money(c.expired_cents)}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.recipients}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.topped_up}</td>
                    <td className="py-2 pr-3 tabular-nums">{c.jobs_on_credit}</td>
                    <td className="py-2 pr-3 tabular-nums">{money(c.revenue_60d_cents)}</td>
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
