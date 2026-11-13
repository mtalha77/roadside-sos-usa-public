import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { brand } from "@rsos/config/brand";
import { fill, getMessages, type Locale } from "@rsos/i18n";

export const SECURITY_EVENTS = [
  "new_sign_in",
  "password_changed",
  "email_changed",
  "phone_changed",
  "second_step_changed",
  "recovery_codes",
  "session_revoked",
  "closure_requested",
] as const;
export type SecurityEvent = (typeof SECURITY_EVENTS)[number];

export type SecurityNoticeProps = {
  event: SecurityEvent;
  name: string;
  time: string;
  device?: string;
  locale?: Locale;
};

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

/** Security notice for account changes (sign-ins, password, email, phone, second step, devices). */
export function SecurityNoticeEmail({
  event,
  name,
  time,
  device,
  locale = "en",
}: SecurityNoticeProps) {
  const t = getMessages(locale).emails.securityNotice;
  const subject = fill(t.subject[event], { brand: brand.name });
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Section>
            <Text style={{ color: colors.text }}>{fill(t.intro, { name })}</Text>
            <Text style={{ color: colors.text }}>{fill(t.body, { event: subject })}</Text>
            <Text style={{ color: colors.muted }}>{fill(t.when, { time })}</Text>
            {device ? (
              <Text style={{ color: colors.muted }}>{fill(t.device, { device })}</Text>
            ) : null}
            <Text style={{ color: colors.text }}>
              {fill(t.notYou, { support: brand.emails.support })}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function securityNoticeSubject(event: SecurityEvent, locale: Locale = "en") {
  return fill(getMessages(locale).emails.securityNotice.subject[event], { brand: brand.name });
}

/** The emailed second-step code. */
export function SignInCodeEmail({ code, locale = "en" }: { code: string; locale?: Locale }) {
  const t = getMessages(locale).emails.securityNotice;
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{fill(t.codeSubject, { brand: brand.name })}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Text style={{ fontSize: "16px", color: colors.text }}>{fill(t.codeBody, { code })}</Text>
          <Text
            style={{ fontSize: "32px", letterSpacing: "6px", fontWeight: 700, color: colors.text }}
          >
            {code}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function signInCodeSubject(locale: Locale = "en") {
  return fill(getMessages(locale).emails.securityNotice.codeSubject, { brand: brand.name });
}
