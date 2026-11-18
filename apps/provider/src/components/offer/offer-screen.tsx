"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { CountdownRing } from "@rsos/ui/countdown-ring";
import { CurrencyInput } from "@rsos/ui/currency-input";
import { LiteMap } from "@rsos/ui/lite-map";
import { PartyPopper } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

export type OfferView = {
  id: string;
  code: string;
  service: string;
  vehicle: string;
  ev: boolean;
  area: string;
  lat: number;
  lng: number;
  miles: number;
  driveMinutes: number;
  towMiles: number | null;
  onHighway: boolean;
  passengers: number;
  safe: boolean;
  expiresAt: number;
  pickAt: number;
  suggestedCents: number;
  minCents: number;
  maxCents: number;
  feeCents: number;
  winningEta: number;
};

type Sent = { priceCents: number; eta: number };
const KEY = "rsos_offer_sent";
/** Arrival times a provider picks with one tap (RSOS-104). */
export const ETA_CHIPS = [15, 30, 45, 60] as const;
const nearestChip = (m: number) =>
  ETA_CHIPS.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), ETA_CHIPS[0]);

/** One-tap tone and vibration when a new request arrives (only after the first tap: browsers block autoplay). */
function alertOnce() {
  try {
    // Browsers block vibration (and log an error) before the first tap on the page.
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 100, 200]);
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.6);
  } catch {
    /* no audio */
  }
}

/**
 * Incoming request (RSOS-054, polished in RSOS-104): full screen with the countdown ring, the job,
 * a big price box pre-filled from the company's price table, arrival chips (15, 30, 45, 60 min)
 * and one "Send quote" button; decline with a reason is secondary; then the outcome.
 */
export function OfferScreen({ offers, now: serverNow }: { offers: OfferView[]; now: number }) {
  const t = useTranslations("portal.offer");
  const f = useFormatter();
  const [now, setNow] = useState(serverNow);
  // The countdown shows wall-clock seconds, so it renders only in the browser (no hydration mismatch).
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const [declined, setDeclined] = useState<string[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const alerted = useRef<string | null>(null);
  const money = (c: number) => f.number(c / 100, { style: "currency", currency: "USD" });

  useEffect(() => {
    try {
      queueMicrotask(() =>
        setSent(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Sent>),
      );
    } catch {
      /* ignore */
    }
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const open = offers.filter((o) => !declined.includes(o.id) && (o.expiresAt > now || sent[o.id]));
  const offer = open[Math.min(index, Math.max(0, open.length - 1))];
  useEffect(() => {
    if (offer && alerted.current !== offer.id && !sent[offer.id]) {
      alerted.current = offer.id;
      alertOnce();
    }
  });

  if (!offer) return <p className="text-lg text-muted-foreground">{t("none")}</p>;
  const mine = sent[offer.id];
  const p = price ?? offer.suggestedCents;
  const e = eta ?? nearestChip(offer.driveMinutes);
  const inRange = p >= offer.minCents && p <= offer.maxCents;
  const send = () => {
    const next = { ...sent, [offer.id]: { priceCents: p, eta: e } };
    setSent(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };
  const decided = mine && now > offer.pickAt;
  const won = decided && mine.eta <= offer.winningEta;

  return (
    <div className="flex flex-col gap-4">
      {open.length > 1 ? (
        <div role="tablist" aria-label={t("stack")} className="flex gap-2 overflow-x-auto">
          {open.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={o.id === offer.id}
              onClick={() => (setIndex(i), setPrice(null), setEta(null))}
              className="min-h-touch shrink-0 rounded-full border px-4 text-sm font-medium aria-selected:border-primary aria-selected:bg-primary/10"
            >
              {o.service} · {o.area}
            </button>
          ))}
        </div>
      ) : null}
      <section
        className="flex flex-col gap-4 rounded-2xl border-2 border-primary bg-card p-4 sm:p-6"
        aria-labelledby="offer-h"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground tabular-nums">{offer.code}</p>
            <h2 id="offer-h" className="text-2xl font-semibold">
              {offer.service}
            </h2>
            <p className="text-muted-foreground">
              {offer.vehicle}
              {offer.ev ? ` · ${t("ev")}` : ""}
            </p>
          </div>
          {mine ? null : !mounted ? (
            <div
              aria-hidden="true"
              className="size-40 shrink-0 rounded-full border-[10px] border-muted"
            />
          ) : (
            <CountdownRing
              startsAt={offer.expiresAt - 180_000}
              endsAt={offer.expiresAt}
              label={t("timeLeft")}
            />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">{t("distance")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {t("miles", { miles: offer.miles })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("drive")}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {t("minutes", { minutes: offer.driveMinutes })}
            </dd>
          </div>
          {offer.towMiles !== null ? (
            <div>
              <dt className="text-sm text-muted-foreground">{t("tow")}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {t("miles", { miles: offer.towMiles })}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-sm text-muted-foreground">{t("area")}</dt>
            <dd className="text-lg font-semibold">{offer.area}</dd>
          </div>
        </dl>
        <ul className="flex flex-wrap gap-2">
          {offer.onHighway ? (
            <li className="rounded-full bg-warning-subtle px-3 py-1 text-sm font-medium text-warning-strong">
              {t("flags.highway")}
            </li>
          ) : null}
          {!offer.safe ? (
            <li className="rounded-full bg-critical-subtle px-3 py-1 text-sm font-medium text-critical-strong">
              {t("flags.unsafe")}
            </li>
          ) : null}
          {offer.passengers > 0 ? (
            <li className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              {t("flags.passengers", { count: offer.passengers })}
            </li>
          ) : null}
        </ul>
        <LiteMap
          label={t("mapLabel")}
          points={[
            {
              id: "req",
              kind: "request",
              tone: "warning",
              lat: offer.lat,
              lng: offer.lng,
              label: offer.area,
            },
          ]}
          radius={{ center: { lat: offer.lat, lng: offer.lng }, miles: 1.5 }}
        />
        <p className="text-sm text-muted-foreground">{t("addressHidden")}</p>

        {mine ? (
          decided ? (
            won ? (
              <Alert tone="success" title={t("won")}>
                <PartyPopper aria-hidden="true" className="inline size-5" /> {t("wonBody")}
              </Alert>
            ) : (
              <Alert tone="info" title={t("lost")} />
            )
          ) : (
            <Alert
              tone="info"
              title={t("waiting", { price: money(mine.priceCents), minutes: mine.eta })}
            />
          )
        ) : (
          <>
            <label className="flex flex-col gap-2 font-semibold" htmlFor={`price-${offer.id}`}>
              {t("yourPrice")}
              <CurrencyInput
                key={offer.id}
                id={`price-${offer.id}`}
                value={p}
                onValueChange={(c) => setPrice(c ?? 0)}
                aria-describedby={`price-hint-${offer.id}`}
                className="min-h-16 text-3xl font-semibold"
              />
              <span
                id={`price-hint-${offer.id}`}
                className={`text-sm font-normal ${inRange ? "text-muted-foreground" : "text-critical-strong"}`}
              >
                {inRange
                  ? t("suggested", {
                      price: money(offer.suggestedCents),
                      fee: money(offer.feeCents),
                    })
                  : t("outOfRange", { min: money(offer.minCents), max: money(offer.maxCents) })}
              </span>
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-semibold">{t("arrival")}</legend>
              <div className="grid grid-cols-4 gap-2">
                {ETA_CHIPS.map((m) => (
                  <label
                    key={m}
                    className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 text-lg font-semibold tabular-nums has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2 has-focus-visible:outline-ring"
                  >
                    <input
                      type="radio"
                      name={`eta-${offer.id}`}
                      value={m}
                      checked={e === m}
                      onChange={() => setEta(m)}
                      className="sr-only"
                    />
                    {t("minutes", { minutes: m })}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              type="button"
              size="lg"
              className="min-h-16 text-lg"
              disabled={!inRange}
              onClick={send}
            >
              {t("send", { price: money(p), minutes: e })}
            </Button>
            <div className="flex flex-wrap gap-2">
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  setDeclined((d) => [...d, offer.id]);
                }}
              >
                <label className="sr-only" htmlFor="decline-reason">
                  {t("declineReason")}
                </label>
                <select
                  id="decline-reason"
                  name="reason"
                  className="min-h-touch rounded-lg border border-input bg-surface px-3"
                >
                  {(["too_far", "busy", "no_equipment", "price"] as const).map((r) => (
                    <option key={r} value={r}>
                      {t(`reasons.${r}`)}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ghost">
                  {t("decline")}
                </Button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
