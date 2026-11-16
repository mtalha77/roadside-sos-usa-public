/**
 * Phone flow (RSOS-030): TwiML for the incoming call (greeting, safety line, optional recording
 * notice, ring dispatchers' browsers, then their mobiles, then voicemail), and the source logic
 * for call tracking and dynamic number insertion. Pure functions: no network, no SDK.
 */

export const TRACKING_SOURCES = [
  "website",
  "google_ads",
  "gmb",
  "meta",
  "bing",
  "organic",
  "provider_line",
  "staging_test",
] as const;
export type TrackingSource = (typeof TRACKING_SOURCES)[number];

// ---------------------------------------------------------------------------------------------
// TwiML
// ---------------------------------------------------------------------------------------------
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (a: Record<string, string | number | boolean | undefined>) =>
  Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join("");
export const twiml = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
/** Adds query parameters to an absolute URL (keeps any already there, e.g. a bypass token). */
export const withQuery = (url: string, q: Record<string, string>) => {
  const u = new URL(url);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  return u.toString();
};
const say = (text: string) => `<Say voice="Polly.Joanna">${esc(text)}</Say>`;

export type CallFlowText = {
  /** "Thanks for calling {brand}. We'll connect you to a dispatcher now." */
  greeting: string;
  /** "If you are in danger, hang up and call 911." */
  safety: string;
  /** Spoken only where recording is enabled for the market. */
  recordingNotice?: string;
  voicemail: string;
  goodbye: string;
};

/**
 * First leg: greeting, safety line, optional recording notice, then ring every available
 * dispatcher's browser softphone at once (first to answer wins). `action` gets the Dial result.
 */
export function incomingCallTwiml(o: {
  text: CallFlowText;
  record: boolean;
  clients: string[];
  action: string;
  recordingStatusCallback?: string;
  timeoutSec?: number;
}): string {
  const intro =
    say(o.text.greeting) +
    say(o.text.safety) +
    (o.record && o.text.recordingNotice ? say(o.text.recordingNotice) : "");
  if (o.clients.length === 0)
    return twiml(
      `${intro}<Redirect method="POST">${esc(withQuery(o.action, { leg: "clients", none: "1" }))}</Redirect>`,
    );
  const dial = `<Dial${attrs({
    action: withQuery(o.action, { leg: "clients" }),
    method: "POST",
    timeout: o.timeoutSec ?? 15,
    answerOnBridge: true,
    record: o.record ? "record-from-answer-dual" : undefined,
    recordingStatusCallback: o.record ? o.recordingStatusCallback : undefined,
  })}>${o.clients.map((c) => `<Client>${esc(c)}</Client>`).join("")}</Dial>`;
  return twiml(intro + dial);
}

/** Second leg: ring the on-duty dispatchers' mobiles (same caller ID), then the voicemail leg. */
export function fallbackCallTwiml(o: {
  numbers: string[];
  callerId: string;
  action: string;
  record: boolean;
  recordingStatusCallback?: string;
}): string {
  if (o.numbers.length === 0)
    return twiml(
      `<Redirect method="POST">${esc(withQuery(o.action, { leg: "numbers", none: "1" }))}</Redirect>`,
    );
  return twiml(
    `<Dial${attrs({
      action: withQuery(o.action, { leg: "numbers" }),
      method: "POST",
      timeout: 20,
      callerId: o.callerId,
      answerOnBridge: true,
      record: o.record ? "record-from-answer-dual" : undefined,
      recordingStatusCallback: o.record ? o.recordingStatusCallback : undefined,
    })}>${o.numbers.map((n) => `<Number>${esc(n)}</Number>`).join("")}</Dial>`,
  );
}

/** Last leg: voicemail with transcription; the callbacks create the urgent inbox item. */
export function voicemailTwiml(o: {
  text: CallFlowText;
  recordingStatusCallback: string;
  transcribeCallback: string;
}): string {
  return twiml(
    say(o.text.voicemail) +
      `<Record${attrs({
        maxLength: 120,
        playBeep: true,
        transcribe: true,
        transcribeCallback: o.transcribeCallback,
        recordingStatusCallback: o.recordingStatusCallback,
        recordingStatusCallbackEvent: "completed",
      })}/>` +
      say(o.text.goodbye),
  );
}

export const hangupTwiml = () => twiml("<Hangup/>");
export const emptyTwiml = () => twiml("");

/** Outbound call from a dispatcher's browser (RSOS-074b): our tracking number as caller ID. */
export function outboundCallTwiml(o: {
  to: string;
  callerId: string;
  statusCallback: string;
}): string {
  return twiml(
    `<Dial${attrs({ callerId: o.callerId, answerOnBridge: true, timeout: 30 })}><Number${attrs({
      statusCallback: o.statusCallback,
      statusCallbackEvent: "answered completed",
    })}>${esc(o.to)}</Number></Dial>`,
  );
}

/** Which leg comes next after a Dial ends. */
export function nextLeg(
  leg: "clients" | "numbers",
  dialStatus: string | null,
): "done" | "numbers" | "voicemail" {
  if (dialStatus === "completed" || dialStatus === "answered") return "done";
  return leg === "clients" ? "numbers" : "voicemail";
}

// ---------------------------------------------------------------------------------------------
// Call tracking: source of a visit, and the number to show (dynamic number insertion)
// ---------------------------------------------------------------------------------------------
export type VisitParams = {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
};

/** gclid or a Google utm_source means Google Ads; Meta and Microsoft likewise; else website. */
export function sourceForVisit(p: VisitParams): TrackingSource {
  const utm = (p.utm_source ?? "").toLowerCase();
  if (p.gclid || p.gbraid || p.wbraid || /^(google|adwords|gads)/.test(utm)) {
    if (utm === "gmb" || utm === "google_business") return "gmb";
    return "google_ads";
  }
  if (utm === "gmb" || utm === "google_business" || utm === "gbp") return "gmb";
  if (p.fbclid || /^(facebook|fb|meta|instagram|ig)$/.test(utm)) return "meta";
  if (p.msclkid || /^(bing|microsoft|msads)$/.test(utm)) return "bing";
  return "website";
}

export type TrackingNumber = { phone: string; source: TrackingSource; active: boolean };

/** The number for this visitor: their source's number in their market, else the website number. */
export function numberForVisit(
  numbers: TrackingNumber[],
  source: TrackingSource,
  fallback: string | null,
): string | null {
  const live = numbers.filter((n) => n.active);
  return (
    live.find((n) => n.source === source)?.phone ??
    live.find((n) => n.source === "website")?.phone ??
    fallback
  );
}

/** Cookie with the visitor's first-touch source (first party, 90 days). */
export const SOURCE_COOKIE = "rsos_src";
export const SOURCE_COOKIE_MAX_AGE = 90 * 24 * 3600;
