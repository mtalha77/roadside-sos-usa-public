import { describe, expect, it, vi } from "vitest";
import {
  chooseEmailSender,
  createMockSender,
  createResendSender,
  SECURITY_EVENTS,
  SecurityNoticeEmail,
  securityNoticeSubject,
  SignInCodeEmail,
} from "../src";

describe("email interface", () => {
  it("renders a notice for every security event in both languages", async () => {
    const sender = createMockSender();
    for (const event of SECURITY_EVENTS) {
      for (const locale of ["en", "es"] as const) {
        await sender.send({
          to: "a@example.test",
          subject: securityNoticeSubject(event, locale),
          react: <SecurityNoticeEmail event={event} name="Ana" time="10:00" locale={locale} />,
        });
      }
    }
    expect(sender.outbox).toHaveLength(SECURITY_EVENTS.length * 2);
    expect(sender.outbox.every((m) => m.html.includes("Ana"))).toBe(true);
  });

  it("emails the sign-in code", async () => {
    const sender = createMockSender();
    await sender.send({
      to: "a@example.test",
      subject: "code",
      react: <SignInCodeEmail code="123456" />,
    });
    expect(sender.outbox[0]!.html).toContain("123456");
  });

  it("sends through Resend when configured", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ id: "re_1" })),
    ) as unknown as typeof fetch;
    const result = await createResendSender("key", "no-reply@example.test", fetchImpl).send({
      to: "a@example.test",
      subject: "s",
      react: <SignInCodeEmail code="1" />,
    });
    expect(result).toEqual({ ok: true, id: "re_1", mode: "resend" });
  });

  it("picks the sender by environment and never fakes sending in production", async () => {
    expect(chooseEmailSender({ RESEND_API_KEY: "k", EMAIL_FROM: "f@example.test" }).mode).toBe(
      "resend",
    );
    expect(chooseEmailSender({ NEXT_PUBLIC_SITE_ENV: "preview" }).mode).toBe("mock");
    const prod = chooseEmailSender({ NEXT_PUBLIC_SITE_ENV: "production" });
    expect(prod.mode).toBe("unavailable");
    expect(
      await prod.send({ to: "a@example.test", subject: "s", react: <SignInCodeEmail code="1" /> }),
    ).toEqual({ ok: false, reason: "not-configured" });
  });
});

describe("form emails (RSOS-026, RSOS-027)", () => {
  it("renders the team notice and the confirmation in both languages", async () => {
    const { TeamNoticeEmail, FormConfirmationEmail, teamNoticeSubject, formConfirmationSubject } =
      await import("../src");
    const { render } = await import("@react-email/components");
    const notice = await render(
      TeamNoticeEmail({
        kind: "contact",
        fields: [
          ["Name", "Dev Test"],
          ["Phone", ""],
        ],
      }),
    );
    expect(notice).toContain("Dev Test");
    expect(teamNoticeSubject("provider_application")).toMatch(/provider application/);
    const es = await render(
      FormConfirmationEmail({ kind: "provider_application", name: "Ana", locale: "es" }),
    );
    expect(es).toContain("Hola Ana");
    expect(formConfirmationSubject("contact", "es")).toBe("Recibimos tu mensaje");
  });
});
