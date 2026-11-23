import { z } from "zod";

export type SmsResult =
  | { ok: true; id: string; mode: "twilio" | "mock" }
  | { ok: false; reason: "not-configured" | "error" };

export interface SmsSender {
  readonly mode: "twilio" | "mock" | "unavailable";
  send(to: string, body: string): Promise<SmsResult>;
}

const E164 = z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/);
const TwilioResponse = z.object({ sid: z.string() });

/** Twilio Messages API over HTTPS (no SDK). `from` is a Twilio number or a Messaging Service SID (MG...). */
export function createTwilioSmsSender(
  accountSid: string,
  authToken: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): SmsSender {
  return {
    mode: "twilio",
    async send(to, body) {
      if (!E164.safeParse(to).success) return { ok: false, reason: "error" };
      const form = new URLSearchParams({ To: to, Body: body });
      form.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
      const res = await fetchImpl(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        },
      );
      if (!res.ok) return { ok: false, reason: "error" };
      const parsed = TwilioResponse.safeParse(await res.json());
      return parsed.success
        ? { ok: true, id: parsed.data.sid, mode: "twilio" }
        : { ok: false, reason: "error" };
    },
  };
}

/** Records texts in memory (development, previews, tests). Nothing is sent. */
export function createMockSmsSender(): SmsSender & { outbox: { to: string; body: string }[] } {
  const outbox: { to: string; body: string }[] = [];
  return {
    mode: "mock",
    outbox,
    async send(to, body) {
      outbox.push({ to, body });
      return { ok: true, id: `mock-${outbox.length}`, mode: "mock" };
    },
  };
}

export const unavailableSmsSender: SmsSender = {
  mode: "unavailable",
  send: async () => ({ ok: false, reason: "not-configured" }),
};

/** Twilio when configured; the mock on development and previews; otherwise unavailable (fails safely). */
export function chooseSmsSender(env: Record<string, string | undefined> = process.env): SmsSender {
  const from = env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER;
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && from)
    return createTwilioSmsSender(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, from);
  const siteEnv = env.NEXT_PUBLIC_SITE_ENV ?? "development";
  if (siteEnv === "development" || siteEnv === "preview" || env.NODE_ENV === "test")
    return createMockSmsSender();
  return unavailableSmsSender;
}
