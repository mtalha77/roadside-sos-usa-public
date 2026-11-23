"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { Mic, MicOff, Pause, Phone, PhoneForwarded, PhoneOff, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type Call = "idle" | "ringing" | "active" | "held";
const card = "rounded-2xl border bg-card p-4 sm:p-5";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Softphone, screen pop and guided intake; the call timer measures time to a created request. */
export function IntakeConsole({
  demo,
  caller,
  history,
  markets,
  services,
  labels: l,
}: {
  demo: boolean;
  caller: { name: string; phone: string };
  history: { code: string; id: string; status: string; at: number }[];
  markets: { slug: string; name: string }[];
  services: { slug: string; name: string }[];
  labels: Record<string, string>;
}) {
  const id = useId();
  const [available, setAvailable] = useState(true);
  const [call, setCall] = useState<Call>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [linkSent, setLinkSent] = useState(false);
  const [created, setCreated] = useState<{ code: string; seconds: number } | null>(null);
  const [error, setError] = useState(false);
  const started = useRef<number | null>(null);
  useEffect(() => {
    if (call !== "active" && call !== "held") return;
    const t = setInterval(
      () => setSeconds(Math.round((Date.now() - (started.current ?? Date.now())) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [call]);
  const answer = () => {
    started.current = Date.now();
    setSeconds(0);
    setCall("active");
    setCreated(null);
  };
  const field = (name: string, label: string, el: React.ReactNode) => (
    <label key={name} className="flex flex-col gap-2 text-sm font-medium">
      {label}
      {el}
    </label>
  );
  return (
    <main
      id="main"
      className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <h1 className="text-2xl font-semibold lg:col-span-2">{l.title}</h1>
      <div className="flex flex-col gap-4">
        <section className={card} aria-labelledby={`${id}-sp`}>
          <h2 id={`${id}-sp`} className="mb-3 font-semibold">
            {l.softphone}
          </h2>
          <label className="mb-3 flex min-h-12 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            {available ? l.available : l.away}
          </label>
          <p role="status" className="mb-3 text-sm">
            {call === "ringing"
              ? `${l.incoming} ${caller.phone}`
              : call === "idle"
                ? l.idle
                : `${l.onCall} · ${mmss(seconds)}`}
          </p>
          {call === "idle" ? (
            <Button
              className="w-full"
              variant="outline"
              disabled={!available}
              onClick={() => setCall("ringing")}
            >
              {demo ? l.simulate : l.startCall}
            </Button>
          ) : null}
          {call === "ringing" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={answer}>
                <Phone aria-hidden="true" />
                {l.answer}
              </Button>
              <Button variant="outline" onClick={() => setCall("idle")}>
                {l.decline}
              </Button>
            </div>
          ) : null}
          {call === "active" || call === "held" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setCall(call === "held" ? "active" : "held")}
              >
                {call === "held" ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                {call === "held" ? l.resume : l.hold}
              </Button>
              <Button variant="outline" aria-pressed={muted} onClick={() => setMuted(!muted)}>
                {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                {muted ? l.unmute : l.mute}
              </Button>
              <Button variant="outline">
                <PhoneForwarded aria-hidden="true" />
                {l.transfer}
              </Button>
              <Button variant="outline" onClick={() => setCall("idle")}>
                <PhoneOff aria-hidden="true" />
                {l.hangUp}
              </Button>
            </div>
          ) : null}
        </section>
        {call !== "idle" ? (
          <section className={card} aria-labelledby={`${id}-pop`}>
            <h2 id={`${id}-pop`} className="mb-2 font-semibold">
              {l.screenPop}
            </h2>
            <p className="font-medium">{caller.name}</p>
            <p className="text-sm text-muted-foreground">{caller.phone}</p>
            <h3 className="mt-3 text-sm font-semibold">{l.history}</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{l.noHistory}</p>
            ) : (
              <ul className="text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/requests/${encodeURIComponent(h.id)}`}
                      prefetch={false}
                      className="inline-flex min-h-12 items-center underline"
                    >
                      {h.code}
                    </Link>{" "}
                    · {h.status}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
      <form
        noValidate
        className={`${card} flex flex-col gap-4`}
        aria-labelledby={`${id}-form`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!e.currentTarget.checkValidity()) {
            setError(true);
            e.currentTarget.reportValidity();
            return;
          }
          setError(false);
          const code = `P-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          setCreated({
            code,
            seconds: started.current ? Math.round((Date.now() - started.current) / 1000) : 0,
          });
        }}
      >
        <h2 id={`${id}-form`} className="text-lg font-semibold">
          {l.form}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "name",
            l.name!,
            <input
              name="name"
              required
              defaultValue={call !== "idle" ? caller.name : ""}
              key={`n-${call}`}
              className={inputClass}
              autoComplete="off"
            />,
          )}
          {field(
            "phone",
            l.phone!,
            <input
              name="phone"
              type="tel"
              required
              defaultValue={call !== "idle" ? caller.phone : ""}
              key={`p-${call}`}
              className={inputClass}
              autoComplete="off"
            />,
          )}
          {field(
            "market",
            l.market!,
            <select name="market" required className={inputClass}>
              {markets.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>,
          )}
          {field(
            "service",
            l.service!,
            <select name="service" required className={inputClass}>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>,
          )}
        </div>
        {field(
          "location",
          l.location!,
          <input name="location" required className={inputClass} placeholder={l.locationHint} />,
        )}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLinkSent(true)}
        >
          {l.sendLink}
        </Button>
        {linkSent ? (
          <p role="status" className="text-sm text-muted-foreground">
            {l.linkSent}
          </p>
        ) : null}
        {field("vehicle", l.vehicle!, <input name="vehicle" className={inputClass} />)}
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">{l.safety}</legend>
          {(["safe", "highway", "unsafe"] as const).map((s) => (
            <label key={s} className="flex min-h-12 items-center gap-3 text-sm">
              <input
                type="radio"
                name="safety"
                value={s}
                required
                defaultChecked={s === "safe"}
                className="size-5"
              />
              {l[s]}
            </label>
          ))}
        </fieldset>
        {error ? <Alert tone="critical" title={l.required} /> : null}
        {created ? (
          <Alert tone="success" title={l.created?.replace("{code}", created.code)}>
            {l.timer?.replace("{time}", mmss(created.seconds))}
          </Alert>
        ) : null}
        <Button type="submit" size="lg" className="self-start">
          {l.create}
        </Button>
      </form>
    </main>
  );
}
