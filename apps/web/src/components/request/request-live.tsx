"use client";

import { demoMaskedNumber } from "@rsos/config/demo-fixtures";
import {
  DRIVER_DEMO_TIMING,
  DRIVER_STAGES,
  type DemoPick,
  type DemoQuote,
  type DemoRequest,
  type DemoStage,
  demoState,
  driverStageStarts,
  milesBetween,
} from "@rsos/core/demo";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { CountdownRing } from "@rsos/ui/countdown-ring";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import { QuoteCard, type QuoteCardLabels } from "@rsos/ui/quote-card";
import { Sheet, SheetContent } from "@rsos/ui/sheet";
import { MessageSquare, Phone, Share2, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { Skeleton } from "@rsos/ui/skeleton";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CompareView } from "./compare-view";
import { ProviderProfilePanel } from "./provider-profile";
import { DemoBar, StageStepper } from "./stage-stepper";
import { useDemoClock } from "./use-demo-clock";
import { MapView } from "@/components/site/map-view";

type RealStatus =
  | "draft"
  | "phone_intake"
  | "submitted"
  | "quoting"
  | "quoted"
  | "contacted"
  | "location_confirmed"
  | "assigned"
  | "accepted"
  | "en_route"
  | "on_site"
  | "completed"
  | "cancelled"
  | "expired"
  | "no_provider";
const REAL_TO_STAGE: Record<RealStatus, DemoStage> = {
  draft: "searching",
  // Manual dispatch (RSOS-034b): the driver sees the same stages.
  phone_intake: "searching",
  contacted: "searching",
  location_confirmed: "searching",
  assigned: "picked",
  no_provider: "expired",
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
const STEP_ORDER: readonly DemoStage[] = DRIVER_STAGES;
type Tag = "fastest" | "best-price" | "top-rated";

/** Fastest, best price and top rated, each on a different quote. */
function tagQuotes(quotes: DemoQuote[]): Map<string, Tag> {
  const tags = new Map<string, Tag>();
  const pickBest = (tag: Tag, score: (q: DemoQuote) => number) => {
    const free = quotes.filter((q) => !tags.has(q.id));
    const best = free.sort((a, b) => score(a) - score(b))[0];
    if (best) tags.set(best.id, tag);
  };
  pickBest("fastest", (q) => q.etaMinutes);
  pickBest("best-price", (q) => q.priceCents);
  pickBest("top-rated", (q) => -(q.provider.rating ?? 0) * 1000 - q.provider.reviews / 1000);
  return tags;
}

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
  /** Real active, non-demo providers serving the market (null without real data). */
  reach?: { count: number; city: string } | null;
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
 * tracking, completed with review, cancel and report at any stage. A demo request runs on the
 * driver's own clock: a stage stepper they can tap back through, Back/Next, 1x/5x and skips.
 * Real requests keep real timing and only move forward.
 */
function RequestLiveView({
  token,
  code,
  serviceName,
  createdAt,
  realStatus,
  simulation,
  supportPhone,
  reach,
}: RequestLiveProps) {
  const t = useTranslations("track");
  const f = useFormatter();
  const isDemo = realStatus === null && simulation !== null;
  const clock = useDemoClock(token, isDemo);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState(realStatus);
  const [pick, setPick] = useState<DemoPick | null>(null);
  const [localEnd, setLocalEnd] = useState<"cancelled" | null>(null);
  const [sort, setSort] = useState<"fastest" | "cheapest">("fastest");
  const [autoPick, setAutoPick] = useState(false);
  const [confirming, setConfirming] = useState<DemoQuote | null>(null);
  const [profile, setProfile] = useState<DemoQuote | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [sheet, setSheet] = useState<"cancel" | "report" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const seen = useRef(0);

  useEffect(() => {
    const raw =
      typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey(token));
    if (raw) {
      try {
        // Restore the driver's choice after a reload.
        const saved = JSON.parse(raw) as DemoPick;
        queueMicrotask(() => setPick(saved));
      } catch {
        /* ignore */
      }
    }
    if (isDemo) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [token, isDemo]);

  useEffect(() => {
    if (realStatus === null) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/r/${token}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setStatus(((await res.json()) as { status: RealStatus }).status);
    }, 4000);
    return () => clearInterval(poll);
  }, [realStatus, token]);

  const sim = useMemo(() => {
    if (!simulation) return null;
    if (!isDemo) return demoState(simulation, now, pick);
    return demoState(simulation, simulation.createdAt + clock.elapsed * 1000, pick, {
      timing: DRIVER_DEMO_TIMING,
      driverControlled: true,
    });
  }, [simulation, isDemo, now, clock.elapsed, pick]);
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
  const tags = useMemo(() => tagQuotes(sim?.quotes ?? []), [sim]);
  const milesTo = (q: DemoQuote) =>
    simulation ? Math.round(milesBetween(q.provider.home, simulation.location) * 10) / 10 : 0;
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

  const savePick = (p: DemoPick | null) => {
    setPick(p);
    try {
      if (p) localStorage.setItem(storageKey(token), JSON.stringify(p));
      else localStorage.removeItem(storageKey(token));
    } catch {
      /* private mode */
    }
  };
  /** Seconds into the request now: the demo clock in demo mode, the wall clock otherwise. */
  const elapsedNow = () =>
    isDemo
      ? Math.max(1, Math.round(clock.elapsed))
      : Math.max(1, Math.round((Date.now() - (simulation?.createdAt ?? createdAt)) / 1000));

  const choose = (q: DemoQuote) => {
    if (pick) return;
    const p = { quoteId: q.id, atSec: elapsedNow() };
    savePick(p);
    setConfirming(null);
    setProfile(null);
    setComparing(false);
    if (isDemo) clock.jumpTo(p.atSec);
  };

  useEffect(() => {
    if (autoPick && stage === "quoting" && quotes[0] && !pick)
      queueMicrotask(() => choose(quotes[0]!));
  });

  // Demo controls: every move is a jump on the demo clock.
  const starts = simulation ? driverStageStarts(simulation, pick) : null;
  const stageIndex = STEP_ORDER.indexOf(stage);
  const fastest = () => [...(sim?.quotes ?? [])].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
  const goTo = (i: number) => {
    if (!isDemo || !starts) return;
    if (i <= 1) {
      // Back to searching or to the quotes: the choice is undone; quotes already in stay in.
      const at = i === 0 ? 0 : (pick?.atSec ?? starts.quoting ?? 0);
      savePick(null);
      setReviewed(false);
      setRating(0);
      clock.jumpTo(at);
      return;
    }
    const at = starts[STEP_ORDER[i] as keyof typeof starts];
    if (at !== null) clock.jumpTo(at);
  };
  const next = () => {
    if (!isDemo || !starts || !simulation) return;
    if (stage === "searching") return clock.jumpTo(starts.quoting ?? 0);
    if (stage === "quoting") {
      const q = fastest();
      if (q) choose(q);
      return;
    }
    goTo(stageIndex + 1);
  };
  const skipToArrival = () => {
    if (!isDemo || !simulation) return;
    let p = pick;
    if (!p) {
      const first = simulation.quotes[0]?.arrivesAtSec ?? 0;
      const q = fastest() ?? [...simulation.quotes].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
      if (!q) return;
      p = { quoteId: q.id, atSec: Math.max(elapsedNow(), first, q.arrivesAtSec) };
      savePick(p);
    }
    const s = driverStageStarts(simulation, p);
    if (s.on_site !== null) clock.jumpTo(s.on_site);
  };
  const canNext = isDemo && stage !== "completed" && (stage !== "quoting" || quotes.length > 0);

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

  const cardLabels: Partial<QuoteCardLabels> = {
    insured: t("card.insured"),
    licensed: t("card.licensed"),
    rating: (r, c) => t("card.rating", { rating: r.toFixed(1), count: c }),
    noRatings: t("card.noRatings"),
    fastest: t("card.fastest"),
    bestPrice: t("card.bestPrice"),
    topRated: t("card.topRated"),
    allIn: t("card.allIn"),
    arrives: t("card.arrives"),
    eta: (m) => t("card.eta", { minutes: m }),
    etaSr: (m) => t("card.etaSr", { minutes: m }),
    choose: (p, price) => t("card.open", { provider: p, price }),
    reviews: (c) => t("card.reviews", { count: c }),
    years: (c) => t("card.years", { count: c }),
    trucks: (c) => t("card.trucks", { count: c }),
    distance: (m) => t("card.distance", { miles: m }),
    selected: t("card.selected"),
  };
  const licensed = (q: DemoQuote) => q.provider.marketSlug !== "las-vegas";
  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-3)));

  const picked = sim?.picked ?? null;
  const active = !["completed", "cancelled", "expired"].includes(stage);
  const showStepper = stageIndex >= 0 && (active || stage === "completed");
  const card = "rounded-2xl border bg-card p-5";
  const skipNext =
    isDemo && canNext ? (
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={next}>
        {t("demo.skipNext")}
      </Button>
    ) : null;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-16">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {showStepper ? (
        <StageStepper
          label={t("tracking.steps")}
          current={stageIndex}
          stages={STEP_ORDER.map((s) => ({ id: s, label: t(`steps.${s}`) }))}
          onGoTo={isDemo ? goTo : undefined}
          goToLabel={(s) => t("demo.goTo", { stage: s })}
        />
      ) : null}
      {isDemo ? (
        <DemoBar
          labels={{
            title: t("demo.title"),
            back: t("demo.back"),
            next: t("demo.next"),
            speed: t("demo.speed"),
            skip: t("demo.skipArrival"),
            speedValue: (x) => t("demo.speedValue", { x }),
          }}
          speed={clock.speed}
          canBack={stageIndex > 0}
          canNext={canNext}
          canSkip={stageIndex >= 0 && stageIndex < STEP_ORDER.indexOf("on_site")}
          onBack={() => goTo(stageIndex - 1)}
          onNext={next}
          onSpeed={clock.setSpeed}
          onSkip={skipToArrival}
        />
      ) : null}
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

      {stage === "searching" ? (
        <section className={`${card} flex flex-col items-center gap-4 text-center`}>
          {isDemo ? null : (
            <CountdownRing
              startsAt={createdAt}
              endsAt={createdAt + 180_000}
              label={t("searching.timeLeft")}
              srLabel={() => t("searching.timeLeft")}
            />
          )}
          <p>{t("searching.body")}</p>
          {reach ? (
            <p className="font-medium">
              {t("searching.reach", { count: reach.count, city: reach.city })}
            </p>
          ) : null}
          <div className="w-full text-left">
            <h2 className="mb-2 font-semibold">{t("searching.whileTitle")}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {(t.raw("searching.while") as string[]).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
          {supportPhone ? (
            <Button asChild variant="outline">
              <a href={`tel:${supportPhone}`}>
                <Phone aria-hidden="true" />
                {t("searching.call", { phone: supportPhone })}
              </a>
            </Button>
          ) : null}
          {skipNext}
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
          <p className="text-sm text-muted-foreground">{t("quotes.tapHint")}</p>
          <ul className="flex flex-col gap-4">
            {quotes.map((q) => (
              <li key={q.id} className="animate-slide-up">
                <QuoteCard
                  labels={cardLabels}
                  selected={compare.includes(q.id)}
                  onSelect={() => setProfile(q)}
                  quote={{
                    id: q.id,
                    provider: {
                      name: q.provider.name,
                      rating: q.provider.rating,
                      reviewCount: q.provider.reviews,
                      insured: true,
                      licensed: licensed(q),
                      logo: q.provider.logo,
                      yearsInBusiness: q.provider.years,
                      trucks: q.provider.trucks,
                    },
                    priceCents: q.priceCents,
                    etaMinutes: q.etaMinutes,
                    tag: tags.get(q.id) ?? null,
                    distanceMiles: milesTo(q),
                  }}
                  action={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={compare.includes(q.id)}
                          onChange={() => toggleCompare(q.id)}
                          className="size-5 accent-[var(--primary)]"
                        />
                        {t("compare.add")}
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirming(q)}
                      >
                        {t("quotes.choose")}
                      </Button>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
          {compare.length >= 2 ? (
            <Button
              type="button"
              variant="outline"
              className="sticky bottom-4 self-center bg-background"
              onClick={() => setComparing(true)}
            >
              {t("compare.open", { count: compare.length })}
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">{t("quotes.waiting")}</p>
          {skipNext}
        </section>
      ) : null}

      {(stage === "picked" || stage === "en_route" || stage === "on_site") &&
      picked &&
      simulation ? (
        <section className="flex flex-col gap-4">
          <MapView
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
              <div className="flex min-w-0 items-center gap-3">
                <ProviderLogo logo={picked.provider.logo} size={44} />
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{picked.provider.name}</p>
                  <p className="font-mono text-sm text-muted-foreground tabular-nums">
                    {money(picked.priceCents)}
                  </p>
                </div>
              </div>
              <div className="text-right" aria-live="polite">
                {stage === "on_site" ? (
                  <Badge tone="success">{t("tracking.arrived")}</Badge>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{t("tracking.etaLabel")}</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                      {t("tracking.minutes", { minutes: sim?.etaMinutes ?? picked.etaMinutes })}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${demoMaskedNumber}`}>
                  <Phone aria-hidden="true" />
                  {t("tracking.call")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`sms:${demoMaskedNumber}`}>
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
            {skipNext}
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
            <p className="text-sm text-muted-foreground">
              {t("confirm.methods", {
                methods: f.list(
                  confirming.provider.payments.map((m) => t(`profile.methods.${m}`)),
                  { type: "conjunction" },
                ),
              })}
            </p>
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

      <ProviderProfilePanel
        quote={profile}
        licensed={profile ? licensed(profile) : false}
        onClose={() => setProfile(null)}
        onChoose={(q) => (setProfile(null), setConfirming(q))}
      />
      <CompareView
        open={comparing}
        quotes={(sim?.quotes ?? []).filter((q) => compare.includes(q.id))}
        milesTo={milesTo}
        onClose={() => setComparing(false)}
        onChoose={(q) => (setComparing(false), setConfirming(q))}
      />

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
