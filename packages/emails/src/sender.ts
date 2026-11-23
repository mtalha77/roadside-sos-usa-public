import type { ReactElement } from "react";
import { render } from "@react-email/components";

export type OutgoingEmail = {
  to: string;
  subject: string;
  react: ReactElement;
  tags?: Record<string, string>;
};
export type SendResult =
  | { ok: true; id: string; mode: "resend" | "mock" }
  | { ok: false; reason: "not-configured" | "error" };

export interface EmailSender {
  readonly mode: "resend" | "mock" | "unavailable";
  send(email: OutgoingEmail): Promise<SendResult>;
}

/** Resend over HTTPS (no SDK). Needs RESEND_API_KEY and EMAIL_FROM (an address on a verified domain). */
export function createResendSender(
  apiKey: string,
  from: string,
  fetchImpl: typeof fetch = fetch,
): EmailSender {
  return {
    mode: "resend",
    async send({ to, subject, react, tags }) {
      const html = await render(react);
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          tags: tags ? Object.entries(tags).map(([name, value]) => ({ name, value })) : undefined,
        }),
      });
      if (!res.ok) return { ok: false, reason: "error" };
      const data = (await res.json()) as { id?: string };
      return { ok: true, id: data.id ?? "", mode: "resend" };
    },
  };
}

/** Records emails in memory (development, previews, tests). Nothing leaves the server. */
export function createMockSender(): EmailSender & {
  outbox: { to: string; subject: string; html: string }[];
} {
  const outbox: { to: string; subject: string; html: string }[] = [];
  return {
    mode: "mock",
    outbox,
    async send({ to, subject, react }) {
      outbox.push({ to, subject, html: await render(react) });
      return { ok: true, id: `mock-${outbox.length}`, mode: "mock" };
    },
  };
}

export const unavailableSender: EmailSender = {
  mode: "unavailable",
  send: async () => ({ ok: false, reason: "not-configured" }),
};

/** Resend when configured; the mock on development and previews; otherwise unavailable (and the caller logs it). */
export function chooseEmailSender(
  env: Record<string, string | undefined> = process.env,
): EmailSender {
  if (env.RESEND_API_KEY && env.EMAIL_FROM)
    return createResendSender(env.RESEND_API_KEY, env.EMAIL_FROM);
  const siteEnv = env.NEXT_PUBLIC_SITE_ENV ?? "development";
  if (siteEnv === "development" || siteEnv === "preview" || env.NODE_ENV === "test")
    return createMockSender();
  return unavailableSender;
}
