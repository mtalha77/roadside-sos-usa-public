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

export type CreditExpiryProps = {
  company: string;
  amount: string;
  date: string;
  days: number;
  locale?: Locale;
};

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export const creditExpirySubject = (days: number, locale: Locale = "en") =>
  fill(getMessages(locale).emails.creditExpiry[days === 1 ? "subjectDay" : "subjectWeek"], {
    brand: brand.name,
  });

/** Bonus credit expiry reminder (RSOS-115), 7 days and 1 day before. Never mentions cash value. */
export function CreditExpiryEmail({
  company,
  amount,
  date,
  days,
  locale = "en",
}: CreditExpiryProps) {
  const t = getMessages(locale).emails.creditExpiry;
  const subject = creditExpirySubject(days, locale);
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
            <Text style={{ color: colors.text }}>{fill(t.intro, { company })}</Text>
            <Text style={{ color: colors.text }}>{fill(t.body, { amount, date })}</Text>
            <Text style={{ color: colors.muted }}>{t.note}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
