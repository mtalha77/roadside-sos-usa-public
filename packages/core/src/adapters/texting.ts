/**
 * Texting rules (RSOS-035), pure so they are unit tested. Texting is OFF in batch 4 (owner scope
 * change: no SMS): every send and the incoming-text webhook need TEXTING_ENABLED=true, and real
 * sends also need the Twilio Messaging keys. Until then only the fakes and these tests run.
 */

type Env = Record<string, string | undefined>;

export function textingEnabled(env: Env = process.env): boolean {
  return env.TEXTING_ENABLED === "true";
}

const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START = new Set(["START", "UNSTOP", "YES"]);
const HELP = new Set(["HELP", "INFO"]);

export type Keyword = "stop" | "start" | "help" | null;

/** Carrier opt-out keywords: the whole message, any case, punctuation ignored. */
export function keywordOf(body: string): Keyword {
  const word = body
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (STOP.has(word)) return "stop";
  if (START.has(word)) return "start";
  if (HELP.has(word)) return "help";
  return null;
}

/** 9pm to 8am in the market's time zone: no non-urgent texts. */
export function inQuietHours(timeZone: string, at = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(at),
  );
  return hour >= 21 || hour < 8;
}

/**
 * Whether a text goes out now. Order: texting off; opted out (blocked, never sent); quiet hours
 * for non-urgent texts; before A2P 10DLC approval a real send only to test numbers.
 */
export function textDecision(o: {
  enabled: boolean;
  optedOut: boolean;
  urgent: boolean;
  quietHours: boolean;
  realSend: boolean;
  a2pApproved: boolean;
  testNumber: boolean;
}): "disabled" | "blocked" | "quiet_hours" | "a2p_pending" | "send" {
  if (!o.enabled) return "disabled";
  if (o.optedOut) return "blocked";
  if (!o.urgent && o.quietHours) return "quiet_hours";
  if (o.realSend && !o.a2pApproved && !o.testNumber) return "a2p_pending";
  return "send";
}
