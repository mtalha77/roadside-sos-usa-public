import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { brand } from "@rsos/config/brand";
import { fill, getMessages } from "@rsos/i18n";
import type { EmailSender, SendResult } from "../sender";

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export type UsageAlert = {
  group: "maps" | "twilio";
  units: number;
  threshold: number;
  day: string;
};

export const usageAlertSubject = (a: UsageAlert) =>
  fill(getMessages("en").emails.opsAlert.usageSubject, {
    brand: brand.name,
    group: getMessages("en").emails.opsAlert.groups[a.group],
  });

/** Owner alert (RSOS-021b): paid API usage passed today's threshold. */
export function UsageAlertEmail(a: UsageAlert) {
  const t = getMessages("en").emails.opsAlert;
  const subject = usageAlertSubject(a);
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Text style={{ color: colors.text }}>
            {fill(t.usageBody, {
              group: t.groups[a.group],
              units: String(a.units),
              threshold: String(a.threshold),
              day: a.day,
            })}
          </Text>
          <Text style={{ color: colors.muted }}>{t.usageHint}</Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Sends the usage alert to the team inbox (once per group per day; the database decides). */
export function sendUsageAlert(sender: EmailSender, a: UsageAlert): Promise<SendResult> {
  return sender.send({
    to: brand.emails.support,
    subject: usageAlertSubject(a),
    react: UsageAlertEmail(a),
    tags: { category: "usage_alert" },
  });
}
