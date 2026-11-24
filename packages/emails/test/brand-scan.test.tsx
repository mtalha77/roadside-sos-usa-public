import { LEGACY_BRAND_PATTERN } from "@rsos/config/brand";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ApplicationApprovedEmail,
  FORM_KINDS,
  FormConfirmationEmail,
  render,
  SECURITY_EVENTS,
  SecurityNoticeEmail,
  SignInCodeEmail,
  WelcomeEmail,
  applicationApprovedSubject,
  formConfirmationSubject,
  securityNoticeSubject,
  signInCodeSubject,
} from "../src";

// RSOS-118: no email (body or subject) and no message string shows a legacy name or domain.
describe("brand scan: emails and messages", () => {
  it("message files contain no legacy name or domain", () => {
    for (const locale of ["en", "es"]) {
      const text = readFileSync(
        new URL(`../../i18n/messages/${locale}.json`, import.meta.url),
        "utf8",
      );
      expect(text).not.toMatch(LEGACY_BRAND_PATTERN);
    }
  });

  it("customer and provider emails render with the current brand only", async () => {
    for (const locale of ["en", "es"] as const) {
      const html = [
        await render(<WelcomeEmail firstName="Alex" locale={locale} />),
        await render(<SignInCodeEmail code="123456" locale={locale} />),
        await render(
          <ApplicationApprovedEmail
            name="Alex"
            company="Test Towing"
            portalUrl="https://pro.example.test"
            locale={locale}
          />,
        ),
        ...(await Promise.all(
          FORM_KINDS.map((kind) =>
            render(<FormConfirmationEmail kind={kind} name="Alex" locale={locale} />),
          ),
        )),
        ...(await Promise.all(
          SECURITY_EVENTS.map((event) =>
            render(
              <SecurityNoticeEmail
                event={event}
                name="Alex"
                time="now"
                device="Phone"
                locale={locale}
              />,
            ),
          ),
        )),
      ].join("\n");
      const subjects = [
        signInCodeSubject(locale),
        applicationApprovedSubject(locale),
        ...FORM_KINDS.map((k) => formConfirmationSubject(k, locale)),
        ...SECURITY_EVENTS.map((e) => securityNoticeSubject(e, locale)),
      ].join("\n");
      expect(html).not.toMatch(LEGACY_BRAND_PATTERN);
      expect(subjects).not.toMatch(LEGACY_BRAND_PATTERN);
    }
  });
});
