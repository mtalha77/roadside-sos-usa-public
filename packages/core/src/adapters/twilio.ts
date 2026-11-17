import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Twilio adapter (batch 4). Screens and server code use these interfaces, never the Twilio SDK.
 * Real implementations call the REST API with fetch; fakes send nothing and are used in tests,
 * local development, previews, staging without keys and demo mode.
 */

const E164 = z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/);
type Env = Record<string, string | undefined>;

// ---------------------------------------------------------------------------------------------
// Webhook signatures (X-Twilio-Signature)
// ---------------------------------------------------------------------------------------------

/**
 * Twilio's request signature: HMAC-SHA1 (auth token) of the full URL followed by every POST
 * parameter name and value, sorted by name, base64-encoded.
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

/** Constant-time check of X-Twilio-Signature. False for a missing signature or token. */
export function validateTwilioSignature(
  authToken: string | undefined,
  url: string,
  params: Record<string, string>,
  signature: string | null | undefined,
): boolean {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---------------------------------------------------------------------------------------------
// Webhook auth token: the real one, or (outside production, no keys) a published test token so
// previews and tests can sign requests. Production never accepts the test token.
// ---------------------------------------------------------------------------------------------
export const FAKE_TWILIO_AUTH_TOKEN = "fake-twilio-auth-token-for-tests";

export function webhookAuthToken(env: Env = process.env): string | null {
  if (env.TWILIO_AUTH_TOKEN) return env.TWILIO_AUTH_TOKEN;
  return (env.NEXT_PUBLIC_SITE_ENV ?? "development") === "production"
    ? null
    : FAKE_TWILIO_AUTH_TOKEN;
}

// ---------------------------------------------------------------------------------------------
// Messaging: texts through the environment's Messaging Service
// ---------------------------------------------------------------------------------------------
export type TextResult =
  | { ok: true; sid: string; segments: number | null }
  | { ok: false; reason: "error"; code?: number };

export interface TextAdapter {
  readonly mode: "real" | "fake";
  send(o: { to: string; body: string; statusCallback?: string }): Promise<TextResult>;
}

/** Sends nothing; returns a well-formed fake SID (tests, previews, demo, no keys). */
export function createFakeTexts(): TextAdapter & { outbox: { to: string; body: string }[] } {
  const outbox: { to: string; body: string }[] = [];
  return {
    mode: "fake",
    outbox,
    async send({ to, body }) {
      if (!E164.safeParse(to).success) return { ok: false, reason: "error" };
      outbox.push({ to, body });
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return { ok: true, sid: `SM${hex}`, segments: segmentCount(body) };
    },
  };
}

const MessageResponse = z.object({
  sid: z.string(),
  num_segments: z.string().nullable().optional(),
});
const ErrorResponse = z.object({ code: z.number().optional() });

export function createTwilioTexts(
  creds: { accountSid: string; authToken: string; messagingServiceSid: string },
  fetchImpl: typeof fetch = fetch,
): TextAdapter {
  return {
    mode: "real",
    async send({ to, body, statusCallback }) {
      if (!E164.safeParse(to).success) return { ok: false, reason: "error" };
      const form = new URLSearchParams({
        To: to,
        Body: body,
        MessagingServiceSid: creds.messagingServiceSid,
      });
      if (statusCallback) form.set("StatusCallback", statusCallback);
      try {
        const res = await fetchImpl(
          `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form,
            signal: AbortSignal.timeout(8000),
          },
        );
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok)
          return { ok: false, reason: "error", code: ErrorResponse.safeParse(data).data?.code };
        const parsed = MessageResponse.safeParse(data);
        if (!parsed.success) return { ok: false, reason: "error" };
        const seg = Number(parsed.data.num_segments);
        return {
          ok: true,
          sid: parsed.data.sid,
          segments: Number.isFinite(seg) && seg > 0 ? seg : null,
        };
      } catch {
        return { ok: false, reason: "error" };
      }
    },
  };
}

/** Real texts only with TEXTING_ENABLED=true and the Messaging keys; otherwise the fake. */
export function chooseTexts(env: Env = process.env): TextAdapter {
  if (
    env.TEXTING_ENABLED === "true" &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_MESSAGING_SERVICE_SID
  )
    return createTwilioTexts({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
    });
  return createFakeTexts();
}

/** SMS segments: 160 GSM-7 characters (153 when split), 70 UCS-2 (67 when split). */
export function segmentCount(body: string): number {
  const gsm = /^[\n\r -~£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¡ÄÖÑÜ§¿äöñüà€^{}\\[\]~|]*$/.test(body);
  const len = [...body].length;
  if (len === 0) return 0;
  const [single, multi] = gsm ? [160, 153] : [70, 67];
  return len <= single ? 1 : Math.ceil(len / multi);
}

// ---------------------------------------------------------------------------------------------
// Lookup: is the caller's number a mobile (can receive texts)?
// ---------------------------------------------------------------------------------------------
export type LineType = "mobile" | "landline" | "voip" | "unknown";
export interface LookupAdapter {
  readonly mode: "real" | "fake";
  lineType(phone: string): Promise<LineType>;
}
const LookupResponse = z.object({
  line_type_intelligence: z.object({ type: z.string().nullable() }).nullable().optional(),
});

export function createTwilioLookup(
  creds: { accountSid: string; authToken: string },
  fetchImpl: typeof fetch = fetch,
): LookupAdapter {
  return {
    mode: "real",
    async lineType(phone) {
      if (!E164.safeParse(phone).success) return "unknown";
      try {
        const res = await fetchImpl(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
          {
            headers: { Authorization: `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}` },
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!res.ok) return "unknown";
        const t = LookupResponse.safeParse(await res.json()).data?.line_type_intelligence?.type;
        if (t === "mobile") return "mobile";
        if (t === "landline") return "landline";
        if (t && /voip/i.test(t)) return "voip";
        return "unknown";
      } catch {
        return "unknown";
      }
    },
  };
}

/** The fake treats every valid US number as a mobile. */
export const fakeLookup: LookupAdapter = {
  mode: "fake",
  lineType: async (phone) => (E164.safeParse(phone).success ? "mobile" : "unknown"),
};

export function chooseLookup(env: Env = process.env): LookupAdapter {
  return env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? createTwilioLookup({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN })
    : fakeLookup;
}

// ---------------------------------------------------------------------------------------------
// Numbers on the Twilio account (admin "Sync from Twilio")
// ---------------------------------------------------------------------------------------------
export type TwilioNumber = { sid: string; phone: string; friendlyName: string };
const NumbersResponse = z.object({
  incoming_phone_numbers: z.array(
    z.object({ sid: z.string(), phone_number: z.string(), friendly_name: z.string() }),
  ),
});

/** Lists the account's numbers (read-only). Null without keys or on error. */
export async function listTwilioNumbers(
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TwilioNumber[] | null> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=200`,
      {
        headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const parsed = NumbersResponse.safeParse(await res.json());
    return parsed.success
      ? parsed.data.incoming_phone_numbers
          .filter((n) => E164.safeParse(n.phone_number).success)
          .map((n) => ({ sid: n.sid, phone: n.phone_number, friendlyName: n.friendly_name }))
      : null;
  } catch {
    return null;
  }
}
