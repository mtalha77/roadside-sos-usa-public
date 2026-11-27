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

export type PlanPriceNoticeProps = {
  company: string;
  plan: string;
  oldPrice: string;
  newPrice: string;
  date: string;
  locale?: Locale;
};

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export const planPriceNoticeSubject = (plan: string, locale: Locale = "en") =>
  fill(getMessages(locale).emails.planPriceNotice.subject, { brand: brand.name, plan });

/**
 * Plan price change notice (RSOS-114), sent at least the notice period (default 30 days) before an
 * existing subscriber's new price starts. Grandfathered subscribers get no notice.
 */
export function PlanPriceNoticeEmail({
  company,
  plan,
  oldPrice,
  newPrice,
  date,
  locale = "en",
}: PlanPriceNoticeProps) {
  const t = getMessages(locale).emails.planPriceNotice;
  const subject = planPriceNoticeSubject(plan, locale);
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
            <Text style={{ color: colors.text }}>
              {fill(t.body, { plan, oldPrice, newPrice, date })}
            </Text>
            <Text style={{ color: colors.muted }}>{t.note}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
