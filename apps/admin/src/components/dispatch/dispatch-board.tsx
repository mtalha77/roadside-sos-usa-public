"use client";

import { Badge } from "@rsos/ui/badge";
import { LiteMap, type LiteMapPoint } from "@rsos/ui/lite-map";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Board, BoardCard, Lane } from "@/lib/board";
import { BoardCardView } from "./board-card";

const LANES: Lane[] = ["new", "quoting", "picked", "en_route", "on_site"];
const POLL_MS = 2000;
const noop = () => () => {};

/** Client side of the dispatch board: polls every 2 s, keeps lanes, map and supply in sync. */
export function DispatchBoard({
  initial,
  demo,
  loadTest,
  services,
  markets,
  labels,
}: {
  initial: Board;
  demo: boolean;
  loadTest: boolean;
  services: Record<string, string>;
  markets: Record<string, string>;
  labels: Record<string, string>;
}) {
  const [board, setBoard] = useState(initial);
  const [error, setError] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [load, setLoad] = useState(loadTest);
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
    const tick = async () => {
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
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
    };
  }, [initial.now]);
  const [clock, setClock] = useState(initial.now);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now() + offset.current), 1000);
    return () => clearInterval(id);
  }, []);

  const cards = board.cards.filter((c) => !hidden.includes(c.id));
  const byLane = useMemo(() => {
    const m = new Map<Lane, BoardCard[]>(LANES.map((l) => [l, []]));
    for (const c of cards) m.get(c.lane)!.push(c);
    for (const l of LANES) m.get(l)!.sort((a, b) => a.createdAt - b.createdAt);
    return m;
  }, [cards]);

  // Sound once when a card first turns red (3 minutes without a quote).
  useEffect(() => {
    if (!mounted) return;
    const red = cards.filter((c) => c.lane === "new" && clock - c.createdAt > 180_000);
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

  const points: LiteMapPoint[] = cards
    .filter((c) => c.lat !== null && c.lng !== null)
    .slice(0, 250)
    .flatMap((c) => [
      {
        id: c.id,
        lat: c.lat!,
        lng: c.lng!,
        kind: "request" as const,
        tone:
          c.lane === "new" && clock - c.createdAt > 180_000
            ? ("critical" as const)
            : c.lane === "new" && clock - c.createdAt > 120_000
              ? ("warning" as const)
              : ("info" as const),
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
    ]);

  return (
    <main id="main" className="flex flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p role="status" className="text-sm text-muted-foreground">
          {error
            ? labels.error
            : `${labels.live} · ${labels.count?.replace("{count}", String(cards.length))}`}
        </p>
        {demo ? (
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={load}
              onChange={(e) => {
                setLoad(e.target.checked);
                document.cookie = `rsos_demo_load=${e.target.checked ? "1" : ""}; path=/; max-age=3600; samesite=lax; secure`;
              }}
            />
            {load ? labels.loadOn : labels.load}
          </label>
        ) : null}
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="map-h" className="rounded-2xl border bg-card p-3">
          <h2 id="map-h" className="sr-only">
            {labels.map}
          </h2>
          <LiteMap label={labels.map!} points={points} className="aspect-[16/7] w-full" />
        </section>
        <section aria-labelledby="sup-h" className="rounded-2xl border bg-card p-4">
          <h2 id="sup-h" className="mb-2 font-semibold">
            {labels.supply}
          </h2>
          {board.supply.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <ul
              tabIndex={0}
              aria-labelledby="sup-h"
              className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm"
            >
              {board.supply.map((s) => (
                <li
                  key={`${s.market}-${s.area}`}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span>
                    {markets[s.market] ?? s.market} · {s.area}
                  </span>
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
      <div className="grid gap-3 pb-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {LANES.map((lane) => {
          const list = byLane.get(lane)!;
          return (
            <section
              key={lane}
              aria-labelledby={`lane-${lane}`}
              className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/50 p-2"
            >
              <h2
                id={`lane-${lane}`}
                className="flex items-center justify-between px-2 pt-1 text-sm font-semibold"
              >
                {labels[`lanes.${lane}`]}
                <span className="tabular-nums text-muted-foreground">{list.length}</span>
              </h2>
              <ul
                tabIndex={0}
                aria-labelledby={`lane-${lane}`}
                className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto"
              >
                {list.slice(0, 80).map((c) => (
                  <li key={c.id}>
                    <BoardCardView
                      card={c}
                      now={mounted ? clock : null}
                      service={services[c.service] ?? c.service}
                      market={markets[c.market] ?? c.market}
                      note={notes[c.id]}
                      labels={labels}
                      onNote={(n) => setNotes((x) => ({ ...x, [c.id]: n }))}
                      onCancel={() => setHidden((h) => [...h, c.id])}
                    />
                  </li>
                ))}
                {list.length > 80 ? (
                  <li className="px-2 text-sm text-muted-foreground">
                    {labels.more?.replace("{count}", String(list.length - 80))}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
