"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Mic, MicOff, Pause, Phone, PhoneForwarded, PhoneOff, Play } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CallInfo,
  answeredAction,
  callInfoAction,
  holdAction,
  setPresenceAction,
  softphoneTokenAction,
  transferAction,
  transferTargetsAction,
} from "@/lib/softphone-actions";

/** Minimal shapes of the Voice SDK objects we use (loaded only when Twilio is connected). */
type SdkCall = {
  parameters: Record<string, string>;
  accept(): void;
  reject(): void;
  disconnect(): void;
  mute(m: boolean): void;
  on(e: "disconnect" | "cancel" | "reject" | "error" | "accept", f: () => void): void;
};
type SdkDevice = {
  register(): Promise<void>;
  destroy(): void;
  updateToken(t: string): void;
  connect(o: { params: Record<string, string> }): Promise<SdkCall>;
  on(e: "incoming", f: (c: SdkCall) => void): void;
  on(e: "tokenWillExpire" | "error" | "registered", f: () => void): void;
};

export type DialRequest = { to: string; requestId?: string; marketId?: string; label: string };
/** Any screen starts a call with: window.dispatchEvent(new CustomEvent(DIAL_EVENT, { detail })). */
export const DIAL_EVENT = "softphone:dial";

type Presence = "available" | "busy" | "away";
type State =
  | { kind: "idle" }
  | { kind: "ringing"; call: SdkCall; info: CallInfo | null }
  | {
      kind: "active";
      call: SdkCall | null;
      sid: string;
      info: CallInfo | null;
      label: string;
      held: boolean;
    }
  | { kind: "dialing"; call: SdkCall; label: string };

/**
 * Softphone dock (RSOS-074b): every dispatcher's browser phone, on every admin screen. Incoming
 * calls show the caller, market, source and request; answer, decline, mute, hold, transfer and
 * hang up; outbound calls start from request and provider pages. Presence decides who is rung.
 */
export function SoftphoneDock({ initialPresence }: { initialPresence: Presence }) {
  const t = useTranslations("admin.softphone");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<
    "loading" | "real" | "fake" | "unsupported" | "error" | "forbidden"
  >("loading");
  const [presence, setPresence] = useState<Presence>(initialPresence);
  const [mic, setMic] = useState<"unknown" | "granted" | "denied">("unknown");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [muted, setMuted] = useState(false);
  const [targets, setTargets] = useState<{ userId: string; name: string }[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const device = useRef<SdkDevice | null>(null);
  const resumeSid = useRef<string | null>(null);

  const changePresence = useCallback(async (p: Presence) => {
    setPresence(p);
    await setPresenceAction(p);
  }, []);

  const finish = useCallback(() => {
    setState({ kind: "idle" });
    setMuted(false);
    setTargets(null);
    void changePresence("available");
  }, [changePresence]);

  // Set up the device once: token, register, incoming calls, token refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tok = await softphoneTokenAction();
      if (cancelled) return;
      if (tok.mode === "forbidden") return setMode("forbidden");
      if (tok.mode === "fake") return setMode("fake");
      try {
        const { Device } = await import("@twilio/voice-sdk");
        if (!Device.isSupported) return setMode("unsupported");
        const d = new Device(tok.token, { closeProtection: true }) as unknown as SdkDevice;
        d.on("incoming", (call: SdkCall) => {
          const sid = call.parameters.CallSid ?? "";
          // A call we put on hold rings back: pick it up again automatically.
          if (resumeSid.current && sid) {
            call.accept();
            setState((s) => (s.kind === "active" ? { ...s, call, held: false } : s));
            resumeSid.current = null;
            return;
          }
          setState({ kind: "ringing", call, info: null });
          setOpen(true);
          call.on("cancel", () => setState({ kind: "idle" }));
          void callInfoAction(sid).then((info) =>
            setState((s) => (s.kind === "ringing" && s.call === call ? { ...s, info } : s)),
          );
        });
        d.on("tokenWillExpire", async () => {
          const next = await softphoneTokenAction();
          if (next.mode === "real") d.updateToken(next.token);
        });
        await d.register();
        device.current = d;
        if (!cancelled) setMode("real");
      } catch {
        if (!cancelled) setMode("error");
      }
    })();
    return () => {
      cancelled = true;
      device.current?.destroy();
    };
  }, []);

  // Outbound calls requested by any screen.
  useEffect(() => {
    const onDial = async (e: Event) => {
      const req = (e as CustomEvent<DialRequest>).detail;
      setOpen(true);
      if (!device.current || mode !== "real") {
        setNotice(t("notConnected"));
        return;
      }
      if (state.kind !== "idle") return setNotice(t("busyAlready"));
      const params: Record<string, string> = { To: req.to };
      if (req.requestId) params.RequestId = req.requestId;
      if (req.marketId) params.MarketId = req.marketId;
      const call = await device.current.connect({ params });
      setState({ kind: "dialing", call, label: req.label });
      void changePresence("busy");
      call.on("accept", () =>
        setState({
          kind: "active",
          call,
          sid: call.parameters.CallSid ?? "",
          info: null,
          label: req.label,
          held: false,
        }),
      );
      call.on("disconnect", finish);
      call.on("error", finish);
    };
    window.addEventListener(DIAL_EVENT, onDial);
    return () => window.removeEventListener(DIAL_EVENT, onDial);
  }, [mode, state.kind, t, changePresence, finish]);

  const askMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const tr of stream.getTracks()) tr.stop();
      setMic("granted");
    } catch {
      setMic("denied");
    }
  };

  const answer = async () => {
    if (state.kind !== "ringing") return;
    const { call, info } = state;
    const sid = call.parameters.CallSid ?? "";
    call.accept();
    call.on("disconnect", () => {
      if (!resumeSid.current) finish();
    });
    setState({ kind: "active", call, sid, info, label: info?.from ?? "", held: false });
    await answeredAction(sid);
    setPresence("busy");
  };

  const hold = async (on: boolean) => {
    if (state.kind !== "active") return;
    if (on) resumeSid.current = state.sid;
    const ok = await holdAction(state.sid, on);
    if (!ok) {
      resumeSid.current = null;
      setNotice(t("holdFailed"));
      return;
    }
    setState({ ...state, held: on });
  };

  const transfer = async (userId: string) => {
    if (state.kind !== "active") return;
    const ok = await transferAction(state.sid, userId);
    if (ok) {
      state.call?.disconnect();
      finish();
      setNotice(t("transferred"));
    } else setNotice(t("transferFailed"));
  };

  const presenceLabel = t(`presence.${presence}`);
  const ringing = state.kind === "ringing";
  return (
    <section
      aria-label={t("title")}
      className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
    >
      <p aria-live="assertive" className="sr-only">
        {ringing ? t("incomingFrom", { caller: state.info?.from ?? t("unknownCaller") }) : ""}
      </p>
      {open ? (
        <div className="w-80 max-w-full rounded-2xl border bg-popover p-4 text-popover-foreground">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{t("title")}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-touch rounded-lg px-3 text-sm font-medium hover:bg-accent"
            >
              {t("minimise")}
            </button>
          </div>

          {mode === "fake" ? <Alert tone="info" title={t("demoMode")} /> : null}
          {mode === "unsupported" ? <Alert tone="warning" title={t("unsupported")} /> : null}
          {mode === "error" ? <Alert tone="critical" title={t("setupError")} /> : null}
          {notice ? (
            <p role="status" className="mb-2 text-sm">
              {notice}
            </p>
          ) : null}

          {mode === "real" && mic !== "granted" ? (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-dashed p-3 text-sm">
              <p>{mic === "denied" ? t("micDenied") : t("micWhy")}</p>
              {mic === "unknown" ? (
                <Button type="button" size="sm" variant="outline" onClick={askMic}>
                  {t("micAllow")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <label className="mb-3 flex flex-col gap-1 text-sm font-medium">
            {t("presenceLabel")}
            <select
              value={presence}
              onChange={(e) => void changePresence(e.target.value as Presence)}
              className="min-h-touch rounded-lg border bg-background px-3"
              disabled={state.kind !== "idle"}
            >
              {(["available", "busy", "away"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`presence.${p}`)}
                </option>
              ))}
            </select>
          </label>

          {state.kind === "ringing" ? (
            <div className="flex flex-col gap-3">
              <p className="text-lg font-semibold tabular-nums">
                {state.info?.from ?? t("unknownCaller")}
              </p>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-muted-foreground">{t("market")}</dt>
                <dd>{state.info?.market ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("source")}</dt>
                <dd>{state.info?.source ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("request")}</dt>
                <dd>
                  {state.info?.requestId ? (
                    <Link className="underline" href={`/requests/${state.info.requestId}`}>
                      {state.info.requestCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
              <div className="flex gap-2">
                <Button type="button" className="flex-1" onClick={answer}>
                  <Phone aria-hidden="true" />
                  {t("answer")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    state.call.reject();
                    setState({ kind: "idle" });
                  }}
                >
                  <PhoneOff aria-hidden="true" />
                  {t("decline")}
                </Button>
              </div>
            </div>
          ) : null}

          {state.kind === "dialing" ? (
            <div className="flex flex-col gap-3">
              <p className="font-semibold">{t("calling", { who: state.label })}</p>
              <Button type="button" variant="outline" onClick={() => state.call.disconnect()}>
                <PhoneOff aria-hidden="true" />
                {t("hangUp")}
              </Button>
            </div>
          ) : null}

          {state.kind === "active" ? (
            <div className="flex flex-col gap-3">
              <p className="font-semibold">
                {state.held ? t("onHold", { who: state.label }) : t("onCall", { who: state.label })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={muted}
                  disabled={state.held}
                  onClick={() => {
                    state.call?.mute(!muted);
                    setMuted(!muted);
                  }}
                >
                  {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  {muted ? t("unmute") : t("mute")}
                </Button>
                <Button type="button" variant="outline" onClick={() => void hold(!state.held)}>
                  {state.held ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  {state.held ? t("resume") : t("hold")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => setTargets(await transferTargetsAction())}
                >
                  <PhoneForwarded aria-hidden="true" />
                  {t("transfer")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (state.call?.disconnect(), finish())}
                >
                  <PhoneOff aria-hidden="true" />
                  {t("hangUp")}
                </Button>
              </div>
              {targets ? (
                targets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noTargets")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {targets.map((x) => (
                      <li key={x.userId}>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => void transfer(x.userId)}
                        >
                          {t("transferTo", { name: x.name })}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        variant={ringing ? "default" : "outline"}
        className={ringing ? "rounded-full" : "rounded-full bg-background"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Phone aria-hidden="true" />
        {ringing ? t("ringing") : t("pill", { presence: presenceLabel })}
      </Button>
    </section>
  );
}
