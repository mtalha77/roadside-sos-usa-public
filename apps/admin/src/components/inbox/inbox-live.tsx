"use client";

import { Badge } from "@rsos/ui/badge";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { InboxItem } from "@/lib/inbox";
import { inboxItemsAction } from "@/lib/inbox-actions";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Data = { items: InboxItem[]; unread: number; unassigned: number };
const PREF = "rsos_inbox_alerts";

const waited = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/**
 * Live inbox (RSOS-034b): new web requests, calls, voicemails and texts in one list, grouped by
 * market, urgent first then longest wait. Supabase Realtime (RLS applies) tells it when to reload.
 * Optional sound and browser notification for new items.
 */
export function InboxLive({
  initial,
  markets,
  selectedId,
}: {
  initial: Data;
  markets: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const t = useTranslations("admin.inbox");
  const [data, setData] = useState(initial);
  const [alerts, setAlerts] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const known = useRef(new Set(initial.items.map((i) => i.id)));

  useEffect(() => {
    try {
      setAlerts(localStorage.getItem(PREF) === "on");
    } catch {
      // Storage blocked: alerts stay off.
    }
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const next = await inboxItemsAction();
        const fresh = next.items.filter((i) => !known.current.has(i.id));
        for (const i of next.items) known.current.add(i.id);
        setData(next);
        if (fresh.length && alerts) notify(fresh[0]!);
      }, 300);
    };
    const channel = supabase.channel("inbox");
    for (const table of ["requests", "calls", "sms_messages", "request_events"])
      channel.on("postgres_changes", { event: "*", schema: "public", table }, reload);
    channel.subscribe();
    // Safety net when Realtime drops (network changes): reload every minute.
    const poll = setInterval(reload, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  const notify = (item: InboxItem) => {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      o.frequency.value = 880;
      o.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    } catch {
      // No audio: the browser notification and the list still show it.
    }
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(t("newItem"), { body: `${item.code} · ${item.phone}` });
  };

  const toggleAlerts = async () => {
    const next = !alerts;
    if (next && "Notification" in window && Notification.permission === "default")
      await Notification.requestPermission();
    setAlerts(next);
    try {
      localStorage.setItem(PREF, next ? "on" : "off");
    } catch {
      // Private mode: the toggle works for this visit.
    }
  };

  const groups = markets
    .map((m) => ({ market: m, items: data.items.filter((i) => i.marketId === m.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <section aria-labelledby="inbox-h" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="inbox-h" className="text-2xl font-semibold">
          {t("title")}
        </h1>
        <label className="flex min-h-touch items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={alerts}
            onChange={() => void toggleAlerts()}
            className="size-5 accent-[var(--primary)]"
          />
          {t("alerts")}
        </label>
      </div>
      <p aria-live="polite" className="flex flex-wrap gap-2 text-sm">
        <Badge tone={data.unread ? "warning" : "neutral"}>
          {t("unread", { count: data.unread })}
        </Badge>
        <Badge tone={data.unassigned ? "warning" : "neutral"}>
          {t("unassigned", { count: data.unassigned })}
        </Badge>
      </p>
      {groups.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("empty")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.market.id} aria-label={g.market.name} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("marketCount", { market: g.market.name, count: g.items.length })}
            </h2>
            <ul className="flex flex-col divide-y rounded-2xl border bg-card">
              {g.items.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/inbox?id=${i.id}`}
                    aria-current={selectedId === i.id ? "true" : undefined}
                    className="flex min-h-touch flex-col gap-1 px-4 py-3 hover:bg-accent aria-[current=true]:bg-accent"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{i.code}</span>
                      {i.urgent ? <Badge tone="critical">{t("urgent")}</Badge> : null}
                      {i.unread ? <Badge tone="warning">{t("new")}</Badge> : null}
                      <Badge tone="neutral">{t(`status.${i.status}`)}</Badge>
                      <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                        {t("waiting", { time: waited(now - i.createdAt) })}
                      </span>
                    </span>
                    <span className="text-sm">
                      {i.driver} · {i.phone}
                      {i.service ? ` · ${i.service}` : ""}
                    </span>
                    <span className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {i.lastCall ? <span>{t(`call.${i.lastCall}`)}</span> : null}
                      <span>
                        {i.owner
                          ? t("owner", { name: i.owner })
                          : i.claimExpired
                            ? t("claimLapsed")
                            : t("unclaimed")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
