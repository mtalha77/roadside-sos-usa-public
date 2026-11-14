"use client";

import {
  type DemoPick,
  type DemoQuote,
  type DemoRequest,
  type DemoStage,
  demoState,
} from "@rsos/core/demo";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { CountdownRing } from "@rsos/ui/countdown-ring";
import { LiteMap } from "@rsos/ui/lite-map";
import { QuoteCard } from "@rsos/ui/quote-card";
import { Sheet, SheetContent } from "@rsos/ui/sheet";
import { Stepper } from "@rsos/ui/stepper";
import { MessageSquare, Phone, Share2, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { Skeleton } from "@rsos/ui/skeleton";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type RealStatus =
  | "draft"
  | "submitted"
  | "quoting"
  | "quoted"
  | "accepted"
  | "en_route"
  | "on_site"
  | "completed"
  | "cancelled"
  | "expired";
const REAL_TO_STAGE: Record<RealStatus, DemoStage> = {
  draft: "searching",
  submitted: "searching",
  quoting: "searching",
  quoted: "quoting",
  accepted: "picked",
  en_route: "en_route",
  on_site: "on_site",
  completed: "completed",
  cancelled: "cancelled",
  expired: "expired",
};
const STEP_ORDER: DemoStage[] = [
  "searching",
  "quoting",
  "picked",
  "en_route",
  "on_site",
  "completed",
];

export type RequestLiveProps = {
  token: string;
  code: string;
  serviceName: string;
  createdAt: number;
  /** Real request: its status (polled). Null for a demo-only request. */
  realStatus: RealStatus | null;
  /** Simulated providers (demo mode only). */
  simulation: DemoRequest | null;
  supportPhone: string | null;
};

const storageKey = (token: string) => `rsos_pick_${token}`;
const noop = () => () => {};

/** Live view only in the browser (it depends on the current second); the server sends a skeleton. */
export function RequestLive(props: RequestLiveProps) {
  const browser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!browser)
    return (
      <div aria-busy="true" className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  return <RequestLiveView {...props} />;
}

/**
 * The driver's status page (RSOS-022, 065 to 069): finding providers, live quotes, confirm,
 * tracking, completed with review, cancel and report at any stage.
 */
function RequestLiveView({
  token,
  code,
  serviceName,
  createdAt,
  realStatus,
  simulation,
  supportPhone,
}: RequestLiveProps) {
  const t = useTranslations("track");
  const f = useFormatter();
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState(realStatus);
  const [pick, setPick] = useState<DemoPick | null>(null);
  const [localEnd, setLocalEnd] = useState<"cancelled" | null>(null);
  const [sort, setSort] = useState<"fastest" | "cheapest">("fastest");
  const [autoPick, setAutoPick] = useState(false);
  const [confirming, setConfirming] = useState<DemoQuote | null>(null);
  const [profile, setProfile] = useState<DemoQuote | null>(null);
  const [sheet, setSheet] = useState<"cancel" | "report" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const confirmLock = useRef(false);
  const seen = useRef(0);

  useEffect(() => {
    const raw =
      typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey(token));
    if (raw) {
      try {
        // Restore the driver's choice after a reload.
        queueMicrotask(() => setPick(JSON.parse(raw) as DemoPick));
      } catch {
        /* ignore */
      }
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [token]);

  useEffect(() => {
    if (realStatus === null) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/r/${token}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setStatus(((await res.json()) as { status: RealStatus }).status);
    }, 4000);
    return () => clearInterval(poll);
  }, [realStatus, token]);

  const sim = useMemo(
    () => (simulation ? demoState(simulation, now, pick) : null),
    [simulation, now, pick],
  );
  const realStage = status ? REAL_TO_STAGE[status] : null;
  const stage: DemoStage =
    localEnd ??
    (realStage === "cancelled" || realStage === "expired" || realStage === "completed"
      ? realStage
      : sim
        ? sim.stage
        : (realStage ?? "searching"));
  const quotes = useMemo(() => {
    const list = [...(sim?.quotes ?? [])];
    return list.sort((a, b) =>
      sort === "fastest" ? a.etaMinutes - b.etaMinutes : a.priceCents - b.priceCents,
    );
  }, [sim, sort]);
  const money = (cents: number) => f.number(cents / 100, { style: "currency", currency: "USD" });

  // Announce each new quote once (polite), not every tick.
  useEffect(() => {
    if (!sim || sim.quotes.length <= seen.current) return;
    const q = sim.quotes[sim.quotes.length - 1]!;
    seen.current = sim.quotes.length;
    queueMicrotask(() =>
      setAnnouncement(
        t("quotes.newQuote", {
          provider: q.provider.name,
          price: money(q.priceCents),
          minutes: q.etaMinutes,
        }),
      ),
    );
  });

  const choose = (q: DemoQuote) => {
    if (confirmLock.current) return;
    confirmLock.current = true;
    const p = {
      quoteId: q.id,
      atSec: Math.max(1, Math.round((Date.now() - (simulation?.createdAt ?? createdAt)) / 1000)),
    };
    setPick(p);
    try {
      localStorage.setItem(storageKey(token), JSON.stringify(p));
    } catch {
      /* private mode */
    }
    setConfirming(null);
  };

  useEffect(() => {
    if (autoPick && stage === "quoting" && quotes[0] && !pick)
      queueMicrotask(() => choose(quotes[0]!));
  });

  const cancel = async (reason: string) => {
    if (realStatus !== null)
      await fetch(`/api/r/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: "cancel", reason }),
      }).catch(() => null);
    setLocalEnd("cancelled");
    setSheet(null);
    setNotice(t("cancel.done"));
  };
  const report = async (kind: string, details: string) => {
    if (realStatus !== null)
      await fetch(`/api/r/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: "report", kind, details }),
      }).catch(() => null);
    setSheet(null);
    setNotice(t("report.sent"));
  };
  const share = async () => {
    const link = window.location.href;
    if (navigator.share) await navigator.share({ url: link, title: code }).catch(() => null);
    else {
      await navigator.clipboard?.writeText(link).catch(() => null);
      setNotice(t("tracking.copied"));
    }
  };

  const picked = sim?.picked ?? null;
  const active = !["completed", "cancelled", "expired"].includes(stage);
  const card = "rounded-2xl border bg-card p-5";
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-16">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground tabular-nums">{t("title", { code })}</p>
        <h1 className="text-3xl font-semibold tracking-tight" aria-live="polite">
          {t(`stages.${stage}`)}
        </h1>
        <p className="text-muted-foreground">{serviceName}</p>
        {simulation ? (
          <p className="text-sm font-medium text-warning-strong">{t("demoNote")}</p>
        ) : null}
      </header>
      {notice ? <Alert tone="success" title={notice} /> : null}
      {active ? (
        <Stepper
          label={t("tracking.steps")}
          current={Math.max(0, STEP_ORDER.indexOf(stage))}
          steps={STEP_ORDER.map((s) => t(`stages.${s}`))}
        />
      ) : null}

      {stage === "searching" ? (
        <section className={`${card} flex flex-col items-center gap-4 text-center`}>
          <CountdownRing
            startsAt={createdAt}
            endsAt={createdAt + 180_000}
            label={t("searching.timeLeft")}
            srLabel={() => t("searching.timeLeft")}
          />
          <p>{t("searching.body")}</p>
          {supportPhone ? (
            <Button asChild variant="outline">
              <a href={`tel:${supportPhone}`}>
                <Phone aria-hidden="true" />
                {t("searching.call", { phone: supportPhone })}
              </a>
            </Button>
          ) : null}
        </section>
      ) : null}

      {stage === "quoting" ? (
        <section aria-labelledby="quotes-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="quotes-h" className="text-xl font-semibold">
              {t("quotes.count", { count: quotes.length })}
            </h2>
            <div role="radiogroup" aria-label={t("quotes.sortLabel")} className="flex gap-2">
              {(["fastest", "cheapest"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={sort === s ? "secondary" : "ghost"}
                  role="radio"
                  aria-checked={sort === s}
                  onClick={() => setSort(s)}
                >
                  {s === "fastest" ? t("quotes.sortFastest") : t("quotes.sortCheapest")}
                </Button>
              ))}
            </div>
          </div>
          <label className="flex min-h-touch items-center gap-3 font-medium">
            <input
              type="checkbox"
              role="switch"
              checked={autoPick}
              onChange={(e) => setAutoPick(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            {t("quotes.autoPick")}
          </label>
          <ul className="flex flex-col gap-4">
            {quotes.map((q, i) => (
              <li key={q.id} className="animate-slide-up">
                <QuoteCard
                  quote={{
                    id: q.id,
                    provider: {
                      name: q.provider.name,
                      rating: q.provider.rating,
                      reviewCount: q.provider.reviews,
                      insured: true,
                      licensed: q.provider.marketSlug !== "las-vegas",
                    },
                    priceCents: q.priceCents,
                    etaMinutes: q.etaMinutes,
                    tag: i === 0 ? (sort === "fastest" ? "fastest" : "best-price") : null,
                  }}
                  action={
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setProfile(q)}>
                        {t("quotes.viewProfile")}
                      </Button>
                      <Button type="button" size="sm" onClick={() => setConfirming(q)}>
                        {t("quotes.choose")}
                      </Button>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t("quotes.waiting")}</p>
        </section>
      ) : null}

      {(stage === "picked" || stage === "en_route" || stage === "on_site") &&
      picked &&
      simulation ? (
        <section className="flex flex-col gap-4">
          <LiteMap
            label={t("tracking.map")}
            route={
              stage === "on_site"
                ? undefined
                : { from: picked.provider.home, to: simulation.location }
            }
            points={[
              {
                id: "me",
                kind: "request",
                lat: simulation.location.lat,
                lng: simulation.location.lng,
                label: serviceName,
              },
              ...(sim?.truck
                ? [
                    {
                      id: "truck",
                      kind: "truck" as const,
                      lat: sim.truck.lat,
                      lng: sim.truck.lng,
                      label: picked.provider.name,
                    },
                  ]
                : []),
            ]}
          />
          <div className={`${card} flex flex-col gap-3`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{picked.provider.name}</p>
                <p className="text-sm text-muted-foreground">{money(picked.priceCents)}</p>
              </div>
              <div className="text-right" aria-live="polite">
                {stage === "on_site" ? (
                  <Badge tone="success">{t("tracking.arrived")}</Badge>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{t("tracking.etaLabel")}</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {t("tracking.minutes", { minutes: sim?.etaMinutes ?? picked.etaMinutes })}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="tel:+15555550100">
                  <Phone aria-hidden="true" />
                  {t("tracking.call")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="sms:+15555550100">
                  <MessageSquare aria-hidden="true" />
                  {t("tracking.text")}
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={share}>
                <Share2 aria-hidden="true" />
                {t("tracking.share")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("tracking.masked")}</p>
          </div>
          <section className={card} aria-labelledby="safety-h">
            <h2 id="safety-h" className="mb-2 font-semibold">
              {t("tracking.safety")}
            </h2>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {(t.raw("tracking.safetyTips") as string[]).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        </section>
      ) : null}

      {stage === "completed" ? (
        <section className="flex flex-col gap-4">
          <div className={card}>
            <h2 className="mb-3 text-xl font-semibold">{t("review.title")}</h2>
            {reviewed ? (
              <Alert tone="success" title={t("review.thanks")} />
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setReviewed(true);
                }}
              >
                <div role="radiogroup" aria-label={t("review.title")} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t("review.stars", { count: n })}
                      onClick={() => setRating(n)}
                      className="grid min-h-touch min-w-touch place-items-center rounded-lg"
                    >
                      <Star
                        aria-hidden="true"
                        className={
                          n <= rating
                            ? "size-8 fill-signal text-signal"
                            : "size-8 text-muted-foreground"
                        }
                      />
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["fast", "friendly", "fair_price", "professional", "clean"] as const).map(
                    (tag) => (
                      <label
                        key={tag}
                        className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-full border px-4 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                      >
                        <input type="checkbox" name="tags" value={tag} className="sr-only" />
                        {t(`review.tags.${tag}`)}
                      </label>
                    ),
                  )}
                </div>
                <label className="flex flex-col gap-2 font-medium">
                  {t("review.comment")}
                  <textarea
                    name="comment"
                    rows={3}
                    className="rounded-lg border border-input bg-surface p-3"
                  />
                </label>
                <Button type="submit" disabled={rating === 0} className="self-start">
                  {t("review.send")}
                </Button>
              </form>
            )}
          </div>
          {picked ? (
            <dl className={`${card} grid grid-cols-2 gap-y-2`}>
              <dt className="text-muted-foreground">{t("receipt.service")}</dt>
              <dd className="text-right">{serviceName}</dd>
              <dt className="text-muted-foreground">{t("receipt.provider")}</dt>
              <dd className="text-right">{picked.provider.name}</dd>
              <dt className="text-muted-foreground">{t("receipt.price")}</dt>
              <dd className="text-right font-semibold tabular-nums">{money(picked.priceCents)}</dd>
              <dt className="col-span-2 text-sm text-muted-foreground">{t("receipt.paid")}</dt>
            </dl>
          ) : null}
        </section>
      ) : null}

      {stage === "cancelled" || stage === "expired" ? (
        <section className={`${card} flex flex-col gap-3`}>
          <p>{stage === "cancelled" ? t("ended.cancelledBody") : t("ended.expiredBody")}</p>
          <Button asChild className="self-start">
            <Link href="/get-help">{t("ended.again")}</Link>
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {active && stage !== "on_site" ? (
          <Button type="button" variant="outline" onClick={() => setSheet("cancel")}>
            {t("cancel.open")}
          </Button>
        ) : null}
        {stage !== "searching" ? (
          <Button type="button" variant="ghost" onClick={() => setSheet("report")}>
            {t("report.open")}
          </Button>
        ) : null}
      </div>

      <Sheet open={confirming !== null} onOpenChange={(o) => (o ? null : setConfirming(null))}>
        {confirming ? (
          <SheetContent title={t("confirm.title", { provider: confirming.provider.name })}>
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">{t("confirm.price")}</dt>
              <dd className="text-right text-xl font-semibold tabular-nums">
                {money(confirming.priceCents)}
              </dd>
              <dt className="text-muted-foreground">{t("confirm.eta")}</dt>
              <dd className="text-right font-semibold tabular-nums">
                {t("confirm.minutes", { minutes: confirming.etaMinutes })}
              </dd>
            </dl>
            <h3 className="mt-3 font-semibold">{t("confirm.included")}</h3>
            <p className="text-sm">{t("confirm.includedBody")}</p>
            <h3 className="mt-3 font-semibold">{t("confirm.extras")}</h3>
            <ul className="list-disc pl-5 text-sm">
              {simulation?.serviceSlug === "tow" ? <li>{t("confirm.extrasTow")}</li> : null}
              <li>{t("confirm.extrasWait")}</li>
            </ul>
            <p className="mt-3 font-medium">{t("confirm.payDirect")}</p>
            <p className="text-sm text-muted-foreground">{t("confirm.methods")}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" onClick={() => choose(confirming)}>
                {t("confirm.confirm")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                {t("confirm.cancel")}
              </Button>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>

      <Sheet open={profile !== null} onOpenChange={(o) => (o ? null : setProfile(null))}>
        {profile ? (
          <SheetContent title={profile.provider.name}>
            <ul className="flex flex-col gap-2">
              <li>
                {profile.provider.rating
                  ? t("profile.rating", {
                      rating: profile.provider.rating.toFixed(1),
                      count: profile.provider.reviews,
                    })
                  : t("profile.newProvider")}
              </li>
              <li>{t("profile.trucks", { count: profile.provider.trucks })}</li>
              <li>{t("profile.based", { area: profile.provider.area })}</li>
              <li>{t("profile.verified")}</li>
            </ul>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => (setProfile(null), setConfirming(profile))}
            >
              {t("quotes.choose")}
            </Button>
          </SheetContent>
        ) : null}
      </Sheet>

      <Sheet open={sheet !== null} onOpenChange={(o) => (o ? null : setSheet(null))}>
        {sheet === "cancel" ? (
          <SheetContent title={t("cancel.title")}>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void cancel(String(new FormData(e.currentTarget).get("reason") ?? "other"));
              }}
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 font-medium">{t("cancel.reason")}</legend>
                {(["found_help", "too_slow", "too_expensive", "fixed", "other"] as const).map(
                  (r, i) => (
                    <label key={r} className="flex min-h-touch items-center gap-3">
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        defaultChecked={i === 0}
                        className="size-5 accent-[var(--primary)]"
                      />
                      {t(`cancel.reasons.${r}`)}
                    </label>
                  ),
                )}
              </fieldset>
              <Button type="submit" variant="destructive">
                {t("cancel.confirm")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSheet(null)}>
                {t("cancel.keep")}
              </Button>
            </form>
          </SheetContent>
        ) : sheet === "report" ? (
          <SheetContent title={t("report.title")}>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void report(String(fd.get("kind") ?? "no_show"), String(fd.get("details") ?? ""));
              }}
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t("report.title")}</legend>
                {(["no_show", "overcharge", "damage", "safety"] as const).map((k, i) => (
                  <label key={k} className="flex min-h-touch items-center gap-3">
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      defaultChecked={i === 0}
                      className="size-5 accent-[var(--primary)]"
                    />
                    {t(`report.kinds.${k}`)}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-2 font-medium">
                {t("report.details")}
                <textarea
                  name="details"
                  rows={3}
                  className="rounded-lg border border-input bg-surface p-3"
                />
              </label>
              <Button type="submit">{t("report.send")}</Button>
            </form>
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  );
}
