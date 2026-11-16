"use client";

import { Button } from "@rsos/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@rsos/ui/dialog";
import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Clock = { offset: number; paused: number | null };

/**
 * Hidden Demo controls (demo mode only): pause, resume, skip ahead and reset the scenario clock
 * that drives the simulated requests on admin screens. Real data is never touched.
 */
export function DemoControls({
  initial,
  labels,
  extra,
}: {
  initial: Clock;
  labels: Record<string, string>;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [clock, setClock] = useState(initial);
  const save = (c: Clock) => {
    setClock(c);
    document.cookie = `rsos_demo_clock=${encodeURIComponent(JSON.stringify(c))}; path=/; max-age=86400; samesite=lax; secure`;
    router.refresh();
  };
  const now = () => clock.paused ?? Date.now() + clock.offset;
  return (
    <Dialog>
      <DialogTrigger className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent">
        <FlaskConical aria-hidden="true" className="size-5 shrink-0" />
        <span>{labels.title}</span>
      </DialogTrigger>
      <DialogContent title={labels.title} description={labels.hint} closeLabel={labels.close}>
        <p role="status" className="text-sm font-medium">
          {clock.paused ? labels.paused : labels.running}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {clock.paused ? (
            <Button
              onClick={() => save({ offset: (clock.paused ?? 0) - Date.now(), paused: null })}
            >
              {labels.resume}
            </Button>
          ) : (
            <Button onClick={() => save({ ...clock, paused: now() })}>{labels.pause}</Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              save(
                clock.paused
                  ? { ...clock, paused: clock.paused + 300_000 }
                  : { ...clock, offset: clock.offset + 300_000 },
              )
            }
          >
            {labels.skip}
          </Button>
          <Button
            variant="outline"
            className="col-span-2"
            onClick={() => save({ offset: 0, paused: null })}
          >
            {labels.reset}
          </Button>
        </div>
        {extra}
      </DialogContent>
    </Dialog>
  );
}
