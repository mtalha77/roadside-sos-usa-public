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

const colors = {
  page: "#f6f7f9",
  card: "#ffffff",
  text: "#1d2029",
  muted: "#4f5563",
  line: "#e3e5ea",
};

/** To a provider whose application was approved (RSOS-035). */
export function ApplicationApprovedEmail({
  name,
  company,
  portalUrl,
  locale = "en",
}: {
  name: string;
  company: string;
  portalUrl: string;
  locale?: Locale;
}) {
  const t = getMessages(locale).emails.applicationApproved;
  const subject = fill(t.subject, { brand: brand.name });
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Text style={{ color: colors.text }}>
            {fill(t.body, { name, company, brand: brand.name })}
          </Text>
          <Text style={{ color: colors.text }}>{fill(t.next, { url: portalUrl })}</Text>
          <Text style={{ color: colors.muted }}>
            {fill(t.help, { support: brand.emails.support })}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const applicationApprovedSubject = (locale: Locale = "en") =>
  fill(getMessages(locale).emails.applicationApproved.subject, { brand: brand.name });

export type DailySummaryRow = {
  market: string;
  requests: number;
  calls: number;
  missed: number;
  assigned: number;
  completed: number;
  noProvider: number;
  feesCents: number;
};

/** Daily dispatch summary for the owner (RSOS-035): yesterday, per market. */
export function DailySummaryEmail({ day, rows }: { day: string; rows: DailySummaryRow[] }) {
  const t = getMessages("en").emails.dailySummary;
  const subject = fill(t.subject, { brand: brand.name, day });
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          {rows.length === 0 ? <Text style={{ color: colors.muted }}>{t.none}</Text> : null}
          {rows.map((r) => (
            <Section
              key={r.market}
              style={{ borderTop: `1px solid ${colors.line}`, paddingTop: "8px" }}
            >
              <Text style={{ color: colors.text, fontWeight: 700, margin: "4px 0" }}>
                {r.market}
              </Text>
              <Text style={{ color: colors.text, margin: "2px 0" }}>
                {fill(t.line, {
                  requests: r.requests,
                  calls: r.calls,
                  missed: r.missed,
                  assigned: r.assigned,
                  completed: r.completed,
                  noProvider: r.noProvider,
                  fees: money(r.feesCents),
                })}
              </Text>
            </Section>
          ))}
          <Text style={{ color: colors.muted }}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const dailySummarySubject = (day: string) =>
  fill(getMessages("en").emails.dailySummary.subject, { brand: brand.name, day });
