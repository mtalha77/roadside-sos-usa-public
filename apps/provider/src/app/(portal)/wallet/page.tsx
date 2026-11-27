import { topUpPresets } from "@rsos/config/demo-fixtures";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { EmptyState } from "@rsos/ui/empty-state";
import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { WalletActions } from "@/components/wallet/wallet-actions";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData, getWallet } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const now = Date.now();
  const [{ data }, wallet] = await Promise.all([
    getPortalData(ctx, now),
    getWallet(ctx.providerId, ctx.demo, now),
  ]);
  return { ctx, data, wallet };
}

/**
 * Wallet and billing (RSOS-057): balance (real), top-up and auto-recharge (card payments wait for
 * Stripe keys), payment methods, transactions by day linked to jobs, statements and plans.
 * Owners and managers only.
 */
const DAY = 86_400_000;

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const days = Math.min(60, Math.max(14, Number((await searchParams).days) || 14));
  const [t, locale, { ctx, data, wallet }] = await Promise.all([
    getTranslations("portal.wallet"),
    getLocale(),
    load(),
  ]);
  if (!ctx.canSeeMoney)
    return (
      <main id="main" className={pageMain}>
        <PageHead title={t("title")} />
        <Alert tone="info" title={t("ownersOnly")} />
      </main>
    );
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const shortDate = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
  });
  const day = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { dateStyle: "full" });
  const groups = new Map<string, typeof data.txns>();
  const newest = data.txns[0]?.at ?? 0;
  const shown = data.txns.filter((x) => x.at > newest - days * DAY);
  for (const x of shown) {
    const k = day.format(x.at);
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  const jobByCode = new Map(data.history.map((j) => [j.code, j]));
  return (
    <main id="main" className={pageMain}>
      <PageHead
        title={t("title")}
        action={
          <Button asChild variant="outline">
            <a href="/wallet/statement" download>
              <Download aria-hidden="true" />
              {t("statement")}
            </a>
          </Button>
        }
      />
      {wallet.welcome ? (
        <Alert
          tone="success"
          title={t("credit.welcome", {
            amount: money(wallet.welcome.cents),
            date: shortDate.format(wallet.welcome.expiresAt),
          })}
        />
      ) : null}
      <section className={card} aria-labelledby="bal-h">
        <h2 id="bal-h" className="text-sm font-medium text-muted-foreground">
          {t("credit.available")}
        </h2>
        <p className="text-5xl font-semibold tabular-nums">
          {money(wallet.paidCents + wallet.bonusCents)}
        </p>
        {/* RSOS-115: the two balances, always shown separately. */}
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <dt className="text-sm text-muted-foreground">{t("credit.paid")}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{money(wallet.paidCents)}</dd>
            <dd className="text-xs text-muted-foreground">{t("credit.paidHint")}</dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              {t("credit.bonus")}
              {wallet.demoCredit ? <Badge tone="outline">{t("credit.demo")}</Badge> : null}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">{money(wallet.bonusCents)}</dd>
            <dd className="text-xs text-muted-foreground">
              {wallet.nextExpiry
                ? t("credit.expires", {
                    amount: money(wallet.nextExpiry.cents),
                    date: shortDate.format(wallet.nextExpiry.at),
                  })
                : t("credit.bonusHint")}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{t("credit.order")}</p>
        <WalletActions
          presets={[...topUpPresets]}
          labels={{
            topUp: t("topUp"),
            topUpTitle: t("topUpTitle"),
            custom: t("custom"),
            stripe: t("stripe"),
            continue: t("continue"),
            close: t("close"),
            auto: t("auto"),
            autoHint: t("autoHint"),
            below: t("below"),
            amount: t("amount"),
            saved: t("saved"),
            presetLabels: topUpPresets.map((c) => money(c)),
          }}
        />
      </section>
      <section className={card} aria-labelledby="ledger-h">
        <h2 id="ledger-h" className="mb-2 font-semibold">
          {t("credit.ledger")}
        </h2>
        {wallet.lines.length === 0 ? (
          <p className="text-muted-foreground">{t("credit.noLines")}</p>
        ) : (
          <ul className="divide-y">
            {wallet.lines.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{t(`credit.kinds.${x.kind}` as never)}</p>
                  <p className="text-sm text-muted-foreground">
                    {shortDate.format(x.at)} ·{" "}
                    {t(x.balance === "bonus" ? "credit.bonus" : "credit.paid")}
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  {x.amountCents > 0 ? "+" : ""}
                  {money(x.amountCents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={card} aria-labelledby="pm-h">
        <h2 id="pm-h" className="mb-2 font-semibold">
          {t("methods")}
        </h2>
        {ctx.demo ? (
          <p>{t("demoCard")}</p>
        ) : (
          <p className="text-muted-foreground">{t("noMethods")}</p>
        )}
      </section>
      <section aria-labelledby="tx-h" className="flex flex-col gap-3">
        <h2 id="tx-h" className="text-lg font-semibold">
          {t("transactions")}
        </h2>
        {data.txns.length === 0 ? (
          <EmptyState title={t("noTxns")} />
        ) : (
          [...groups].map(([label, items]) => (
            <div key={label} className={card}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h3>
              <ul className="divide-y">
                {items.map((x) => {
                  const job = x.jobCode ? jobByCode.get(x.jobCode) : undefined;
                  return (
                    <li
                      key={x.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div>
                        <p className="font-medium">{t(`kinds.${x.kind}`)}</p>
                        {job ? (
                          <Link
                            href={`/jobs/${encodeURIComponent(job.id)}?at=${job.at}`}
                            className="inline-flex min-h-12 items-center text-sm underline"
                          >
                            {t("forJob", { code: job.code })}
                          </Link>
                        ) : null}
                      </div>
                      <p className="font-semibold tabular-nums">{money(x.amountCents)}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {shown.length < data.txns.length ? (
          <Button asChild variant="outline" className="self-start">
            <Link href={`/wallet?days=${days + 14}`} scroll={false}>
              {t("more")}
            </Link>
          </Button>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("disputeHint")}</p>
      </section>
      <section aria-labelledby="plans-h" className={card}>
        <h2 id="plans-h" className="text-lg font-semibold">
          {t("plans")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("plansMoved")}</p>
        <Link
          href="/plan"
          className="inline-flex min-h-touch items-center font-medium underline underline-offset-4"
        >
          {t("plansLink")}
        </Link>
      </section>
    </main>
  );
}
