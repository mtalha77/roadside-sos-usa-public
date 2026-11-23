"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { Switch } from "@rsos/ui/switch";
import { useId, useState } from "react";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

/** Alert channels, sound, test alert and quiet hours (kept on this device in demo mode). */
export function NotificationSettings({
  labels,
  sounds,
}: {
  labels: Record<string, string>;
  sounds: { id: string; label: string }[];
}) {
  const base = useId();
  const [on, setOn] = useState({ push: true, sms: true, voice: false });
  const [sound, setSound] = useState(sounds[0]?.id ?? "");
  const [quiet, setQuiet] = useState(false);
  const [from, setFrom] = useState("23:00");
  const [to, setTo] = useState("06:00");
  const [tested, setTested] = useState(false);
  const [saved, setSaved] = useState(false);
  const test = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = sound === "chime" ? 880 : sound === "horn" ? 220 : 660;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // No audio available (for example, a muted browser): the visible message still confirms.
    }
    navigator.vibrate?.([200, 100, 200]);
    setTested(true);
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
    >
      <section className={card} aria-labelledby={`${base}-ch`}>
        <h2 id={`${base}-ch`} className="mb-2 font-semibold">
          {labels.channels}
        </h2>
        {(["push", "sms", "voice"] as const).map((c) => (
          <div key={c} className="flex min-h-14 items-center justify-between gap-4 py-2">
            <label htmlFor={`${base}-${c}`} className="font-medium">
              {labels[c]}
              <span className="block text-sm font-normal text-muted-foreground">
                {labels[`${c}Hint`]}
              </span>
            </label>
            <Switch
              id={`${base}-${c}`}
              checked={on[c]}
              onCheckedChange={(v) => {
                setOn((o) => ({ ...o, [c]: v }));
                setSaved(false);
              }}
            />
          </div>
        ))}
      </section>
      <section className={card}>
        <label htmlFor={`${base}-sound`} className="mb-2 block font-semibold">
          {labels.sound}
        </label>
        <div className="flex flex-wrap gap-3">
          <select
            id={`${base}-sound`}
            className={`${inputClass} max-w-xs`}
            value={sound}
            onChange={(e) => setSound(e.target.value)}
          >
            {sounds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={test}>
            {labels.test}
          </Button>
        </div>
        {tested ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {labels.testSent}
          </p>
        ) : null}
      </section>
      <section className={card}>
        <div className="flex min-h-14 items-center justify-between gap-4">
          <label htmlFor={`${base}-quiet`} className="font-semibold">
            {labels.quiet}
            <span className="block text-sm font-normal text-muted-foreground">
              {labels.quietHint}
            </span>
          </label>
          <Switch
            id={`${base}-quiet`}
            checked={quiet}
            onCheckedChange={(v) => {
              setQuiet(v);
              setSaved(false);
            }}
          />
        </div>
        {quiet ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.from}
              <input
                type="time"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.to}
              <input
                type="time"
                className={inputClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </section>
      {saved ? <Alert tone="success" title={labels.saved} /> : null}
      <Button type="submit" size="lg" className="self-start">
        {labels.save}
      </Button>
    </form>
  );
}
