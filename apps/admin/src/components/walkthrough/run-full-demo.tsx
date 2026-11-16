"use client";

import { Button } from "@rsos/ui/button";
import { Play } from "lucide-react";
import { useState } from "react";

/**
 * "Run full demo": resets the admin scenario clock to now and opens the same fresh demo job in the
 * website (driver), the provider portal and the admin request page, side by side.
 */
export function RunFullDemo({
  links,
  labels: l,
}: {
  links: { web: string; provider: string; admin: string };
  labels: Record<string, string>;
}) {
  const [started, setStarted] = useState(false);
  const run = () => {
    document.cookie = `rsos_demo_clock=${encodeURIComponent(JSON.stringify({ offset: 0, paused: null }))}; path=/; max-age=86400; samesite=lax; secure`;
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
