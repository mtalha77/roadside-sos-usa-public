"use client";

import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { LiteMap, type LiteMapPoint } from "@rsos/ui/lite-map";
import { SidePanel, SidePanelContent } from "@rsos/ui/side-panel";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Board, BoardCard } from "@/lib/board";
import { ageTone, formatAge, LANES, type Lane } from "@/lib/board-time";
import { PageTourButton } from "@/components/tours/admin-tours";
import { BoardCardView } from "./board-card";

const POLL_MS = 2000;
const SHOWN = 80;
const noop = () => () => {};
export type Source = "real" | "demo" | "both";
const SOURCES: Source[] = ["real", "demo", "both"];

/**
 * Client side of the dispatch board (RSOS-034 + 072, rebuilt in RSOS-103): one market at a time
 * (map with area names, pins at their coordinates, clustered so they never overlap), lanes plus
 * "Needs closing", a Real / Demo / Both filter (Real by default), a side panel with the detail
 * and actions, and keys: J/K move, Enter opens, A assigns, C calls. Polls every 2 seconds.
 */
export function DispatchBoard({
  initial,
  market: initialMarket,
  source: initialSource,
  services,
  markets,
  labels,
}: {
  initial: Board;
  market: string;
  source: Source;
  services: Record<string, string>;
  /** The markets in view, slug to name, in menu order. */
  markets: Record<string, string>;
  labels: Record<string, string>;
}) {
  const [board, setBoard] = useState(initial);
  const [error, setError] = useState(false);
  const [market, setMarket] = useState(initialMarket);
  const [source, setSource] = useState<Source>(initialSource);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [focused, setFocused] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const offset = useRef(0);
  const redSeen = useRef(new Set<string>());

  useEffect(() => {
    offset.current = initial.now - Date.now();
    let stop = false;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const res = await fetch("/api/board", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as Board;
        if (stop) return;
        offset.current = next.now - Date.now();
        setBoard(next);
        setError(false);
      } catch {
        if (!stop) setError(true);
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
      // Cancel a poll still in flight when leaving the page (no error after navigation).
      controller.abort();
    };
  }, [initial.now]);
  const [clock, setClock] = useState(initial.now);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now() + offset.current), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the choice in the address so a reload or a shared link shows the same view.
  const choose = (next: { market?: string; source?: Source }) => {
    const m = next.market ?? market;
    const s = next.source ?? source;
    setMarket(m);
    setSource(s);
    window.history.replaceState(null, "", `/dispatch?market=${m}&source=${s}`);
  };

  const cards = useMemo(
    () =>
      board.cards.filter(
        (c) =>
          c.market === market &&
          !hidden.includes(c.id) &&
          (source === "both" || (source === "demo") === c.demo),
      ),
    [board.cards, market, hidden, source],
  );
  const byLane = useMemo(() => {
    const m = new Map<Lane, BoardCard[]>(LANES.map((l) => [l, []]));
    for (const c of cards) m.get(c.lane)!.push(c);
    for (const l of LANES) m.get(l)!.sort((a, b) => a.createdAt - b.createdAt);
    return m;
  }, [cards]);
  // Keyboard order: lane by lane, top to bottom (what is on screen).
  const order = useMemo(() => LANES.flatMap((l) => byLane.get(l)!.slice(0, SHOWN)), [byLane]);
  const current = cards.find((c) => c.id === open) ?? null;

  const act = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };
  const actions = {
    call: () => act(labels.softphone!),
    assign: () => act(labels.assigned!),
    push: () => act(labels.pushed!),
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !order.length) return;
      const i = order.findIndex((c) => c.id === focused);
      const go = (n: number) => {
        const next = order[Math.max(0, Math.min(order.length - 1, n))]!;
        setFocused(next.id);
        document.querySelector<HTMLElement>(`[data-card="${next.id}"]`)?.focus();
      };
      const k = e.key.toLowerCase();
      if (k === "j") go(i + 1);
      else if (k === "k") go(i < 0 ? 0 : i - 1);
      else if (e.key === "Enter" && focused && el?.dataset.card !== focused) setOpen(focused);
      else if (k === "a" && focused) {
        setOpen(focused);
        actions.assign();
      } else if (k === "c" && focused) {
        setOpen(focused);
        actions.call();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Sound once when a card first turns red (10 minutes without a quote).
  useEffect(() => {
    if (!mounted) return;
    const red = cards.filter((c) => ageTone(c.lane === "new", clock - c.createdAt) === "critical");
    const fresh = red.filter((c) => !redSeen.current.has(c.id));
    for (const c of red) redSeen.current.add(c.id);
    if (fresh.length && redSeen.current.size > fresh.length) {
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        o.frequency.value = 880;
        o.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.25);
      } catch {
        /* sound unavailable */
      }
    }
  }, [cards, clock, mounted]);

  const points: LiteMapPoint[] = [
    ...board.areas
      .filter((a) => a.market === market)
      .map((a) => ({
        id: `area-${a.name}`,
        lat: a.lat,
        lng: a.lng,
        kind: "area" as const,
        label: a.name,
      })),
    ...cards
      .filter((c) => c.lat !== null && c.lng !== null)
      .slice(0, 250)
      .flatMap((c) => {
        const tone = ageTone(c.lane === "new", clock - c.createdAt);
        return [
          {
            id: c.id,
            lat: c.lat!,
            lng: c.lng!,
            kind: "request" as const,
            tone: tone ?? ("info" as const),
            label: `${c.code} · ${labels[`lanes.${c.lane}`]}`,
          },
          ...(c.truck
            ? [
                {
                  id: `${c.id}-truck`,
                  ...c.truck,
                  kind: "truck" as const,
                  label: `${c.provider ?? ""} · ${c.code}`,
                },
              ]
            : []),
        ];
      }),
  ];
  const supply = board.supply.filter((s) => s.market === market);
  const age = (c: BoardCard) => formatAge(clock - c.createdAt, { stale: labels.stale! });

  return (
    <main id="main" className="flex flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">{labels.title}</h1>
        <label data-tour="board-market" className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{labels.market}</span>
          <select
            value={market}
            onChange={(e) => choose({ market: e.target.value })}
            className="min-h-12 rounded-lg border bg-background px-3 text-sm"
          >
            {Object.entries(markets).map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div
          role="group"
          aria-label={labels.source}
          data-tour="board-source"
          className="flex rounded-lg border p-1"
        >
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={source === s}
              onClick={() => choose({ source: s })}
              className="min-h-10 rounded-md px-3 text-sm font-medium aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {labels[`sources.${s}`]}
            </button>
          ))}
        </div>
        <PageTourButton tour="admin.page.dispatch" label={labels.pageTour!} />
      </header>
      <p role="status" className="-mt-2 text-sm text-muted-foreground">
        {error
          ? labels.error
          : `${labels.live} · ${labels.count?.replace("{count}", String(cards.length))} · ${labels.keys}`}
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-labelledby="map-h"
          data-tour="board-map"
          className="rounded-2xl border bg-card p-3"
        >
          <h2 id="map-h" className="sr-only">
            {labels.map}
          </h2>
          <LiteMap
            label={`${labels.map} · ${markets[market] ?? market}`}
            points={points}
            cluster={22}
            className="aspect-[16/7] w-full"
          />
        </section>
        <section aria-labelledby="sup-h" className="rounded-2xl border bg-card p-4">
          <h2 id="sup-h" className="mb-2 font-semibold">
            {labels.supply}
          </h2>
          {supply.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ul
              tabIndex={0}
              aria-labelledby="sup-h"
              className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm"
            >
              {supply.map((s) => (
                <li key={s.area} className="flex items-center justify-between gap-2 py-1">
                  <span>{s.area}</span>
                  {s.online === 0 ? (
                    <Badge tone="critical">{labels.gap}</Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {s.online} {labels.online}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div
        data-tour="board-lanes"
        className="grid gap-3 pb-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {LANES.map((lane) => {
          const list = byLane.get(lane)!;
          return (
            <section
              key={lane}
              aria-labelledby={`lane-${lane}`}
              className={`flex min-w-0 flex-col gap-2 rounded-2xl p-2 ${lane === "closing" ? "bg-warning-subtle/60" : "bg-muted/50"}`}
            >
              <h2
                id={`lane-${lane}`}
                className="flex items-center justify-between px-2 pt-1 text-sm font-semibold"
              >
                {labels[`lanes.${lane}`]}
                <span className="tabular-nums text-muted-foreground">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="px-2 pb-2 text-sm text-muted-foreground">{labels.laneEmpty}</p>
              ) : (
                <ul
                  tabIndex={-1}
                  aria-labelledby={`lane-${lane}`}
                  className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-0.5"
                >
                  {list.slice(0, SHOWN).map((c) => (
                    <li key={c.id}>
                      <BoardCardView
                        card={c}
                        now={mounted ? clock : null}
                        service={services[c.service] ?? c.service}
                        selected={focused === c.id}
                        labels={labels}
                        onFocus={() => setFocused(c.id)}
                        onOpen={() => {
                          setFocused(c.id);
                          setOpen(c.id);
                        }}
                      />
                    </li>
                  ))}
                  {list.length > SHOWN ? (
                    <li className="px-2 text-sm text-muted-foreground">
                      {labels.more?.replace("{count}", String(list.length - SHOWN))}
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <SidePanel open={current !== null} onOpenChange={(o) => (o ? null : setOpen(null))}>
        {current ? (
          <SidePanelContent
            title={`${current.code} · ${services[current.service] ?? current.service}`}
            description={`${markets[current.market] ?? current.market} · ${labels[`lanes.${current.lane}`]} · ${mounted ? age(current) : ""}`}
            closeLabel={labels.close!}
            footer={
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={actions.assign}>{labels.assign}</Button>
                <Button variant="outline" onClick={actions.call}>
                  {labels.call}
                </Button>
              </div>
            }
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{labels.customer}</dt>
              <dd>{current.driver}</dd>
              <dt className="text-muted-foreground">{labels.phone}</dt>
              <dd className="tabular-nums">{current.phone}</dd>
              <dt className="text-muted-foreground">{labels.where}</dt>
              <dd>{current.area}</dd>
              <dt className="text-muted-foreground">{labels.provider}</dt>
              <dd>{current.provider ?? "–"}</dd>
              <dt className="text-muted-foreground">{labels.quotesLabel}</dt>
              <dd className="tabular-nums">{current.quotes}</dd>
              <dt className="text-muted-foreground">{labels.kind}</dt>
              <dd>{current.demo ? labels.demo : labels.real}</dd>
            </dl>
            {notes[current.id] ? (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">{notes[current.id]}</p>
            ) : null}
            {flash ? (
              <p role="status" className="mt-4 text-sm font-medium text-success-strong">
                {flash}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="outline" onClick={actions.push}>
                {labels.push}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const n = window.prompt(labels.note, notes[current.id] ?? "");
                  if (n !== null) {
                    setNotes((x) => ({ ...x, [current.id]: n }));
                    act(labels.noted!);
                  }
                }}
              >
                {labels.note}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setHidden((h) => [...h, current.id]);
                  setOpen(null);
                }}
              >
                {labels.cancel}
              </Button>
              {current.token || !current.demo ? (
                <Link
                  href={
                    current.demo
                      ? `/requests/${encodeURIComponent(current.token!)}`
                      : `/inbox?id=${current.id}`
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-medium underline-offset-2 hover:underline"
                >
                  {labels.open}
                </Link>
              ) : null}
            </div>
          </SidePanelContent>
        ) : null}
      </SidePanel>
    </main>
  );
}
