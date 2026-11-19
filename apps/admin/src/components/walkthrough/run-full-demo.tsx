"use client";

import { Button } from "@rsos/ui/button";
import { TIMING } from "@rsos/core/demo";
import { Play, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Points in the demo job, in seconds after it starts (from the shared demo timing). */
const STAGES = [
  { key: "quotes", at: 0 },
  { key: "picked", at: TIMING.pickAt },
  { key: "onTheWay", at: TIMING.pickAt + 30 },
  { key: "onSite", at: TIMING.pickAt + TIMING.travelSec },
  { key: "done", at: TIMING.pickAt + TIMING.travelSec + TIMING.workSec },
] as const;

/** Sets the admin scenario clock so the demo job is `atSec` seconds old; returns its start. */
function setDemoClock(startedAt: number | null, atSec: number): number {
  const now = Date.now();
  const start = startedAt ?? now;
  const offset = start + atSec * 1000 - now;
  document.cookie = `rsos_demo_clock=${encodeURIComponent(JSON.stringify({ offset, paused: null }))}; path=/; max-age=86400; samesite=lax; secure`;
  return start;
}

/**
 * "Run full demo": resets the admin scenario clock to now and opens the same fresh demo job in the
 * website (customer), the provider portal and the admin request page, side by side. A step list
 * (RSOS-105) jumps the admin scenario to any point, and Skip moves to the next one.
 */
export function RunFullDemo({
  links,
  labels: l,
}: {
  links: { web: string; provider: string; admin: string };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const jump = (n: number) => {
    setDemoClock(startedAt, STAGES[n]!.at);
    setStage(n);
    router.refresh();
  };
  const run = () => {
    setStartedAt(setDemoClock(null, 0));
    setStage(0);
    for (const url of [links.web, links.provider, links.admin])
      window.open(url, "_blank", "noopener");
    setStarted(true);
  };
  return (
    <section
      aria-labelledby="run-h"
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <h2 id="run-h" className="text-lg font-semibold">
        {l.run}
      </h2>
      <p className="text-sm text-muted-foreground">{l.runHint}</p>
      <Button size="lg" className="self-start" onClick={run}>
        <Play aria-hidden="true" />
        {l.run}
      </Button>
      {started ? (
        <p role="status" className="text-sm">
          {l.started}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{l.stepsTitle}</h3>
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s, n) => (
            <li key={s.key}>
              <Button
                variant={stage === n ? "default" : "outline"}
                size="sm"
                aria-current={stage === n ? "step" : undefined}
                onClick={() => jump(n)}
              >
                {l[`stage.${s.key}`]}
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          className="self-start"
          disabled={stage >= STAGES.length - 1}
          onClick={() => jump(stage + 1)}
        >
          <SkipForward aria-hidden="true" />
          {l.skip}
        </Button>
        <p className="text-sm text-muted-foreground">{l.stepsHint}</p>
      </div>
      <ul className="flex flex-wrap gap-3 text-sm">
        <li>
          <a
            href={links.web}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center underline"
          >
            {l.openWeb}
          </a>
        </li>
        <li>
          <a
            href={links.provider}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center underline"
          >
            {l.openProvider}
          </a>
        </li>
        <li>
          <a
            href={links.admin}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center underline"
          >
            {l.openAdmin}
          </a>
        </li>
      </ul>
    </section>
  );
}
