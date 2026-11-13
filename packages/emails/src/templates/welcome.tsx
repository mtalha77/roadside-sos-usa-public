import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { brand } from "@rsos/config/brand";
import { fill, getMessages, type Locale } from "@rsos/i18n";

export type WelcomeEmailProps = {
  firstName: string;
  locale?: Locale;
};

/** Email clients do not support CSS variables, so emails use the hex palette from the tokens. */
const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

/** Starter template. Real transactional emails are added with the features that send them. */
export function WelcomeEmail({ firstName, locale = "en" }: WelcomeEmailProps) {
  const t = getMessages(locale).emails.welcome;
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{fill(t.preview, { brand: brand.name })}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "24px", color: colors.text }}>
            {fill(t.heading, { brand: brand.name, name: firstName })}
          </Heading>
          <Section>
            <Text style={{ fontSize: "16px", lineHeight: "24px", color: colors.text }}>
              {t.tagline}
            </Text>
            <Text style={{ fontSize: "14px", color: colors.muted }}>
              {t.questions}{" "}
              <Link href={`mailto:${brand.emails.support}`}>{brand.emails.support}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmail.PreviewProps = { firstName: "Alex" } satisfies WelcomeEmailProps;

export default WelcomeEmail;
