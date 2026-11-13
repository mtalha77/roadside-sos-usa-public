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

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export const FORM_KINDS = ["contact", "provider_application"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

/** Internal notice to the team: a new form submission, field by field (plain text values only). */
export function TeamNoticeEmail({
  kind,
  fields,
}: {
  kind: FormKind;
  fields: [label: string, value: string][];
}) {
  const t = getMessages("en").emails.teamNotice;
  const subject = fill(t.subject[kind], { brand: brand.name });
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Section>
            {fields.map(([label, value]) => (
              <Text key={label} style={{ color: colors.text, margin: "0 0 8px" }}>
                <strong>{label}:</strong> {value || "—"}
              </Text>
            ))}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const teamNoticeSubject = (kind: FormKind) =>
  fill(getMessages("en").emails.teamNotice.subject[kind], { brand: brand.name });

/** Confirmation to the person who sent a form (contact message or provider application). */
export function FormConfirmationEmail({
  kind,
  name,
  locale = "en",
}: {
  kind: FormKind;
  name: string;
  locale?: Locale;
}) {
  const t = getMessages(locale).emails.formConfirmation;
  const subject = fill(t.subject[kind], { brand: brand.name });
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Text style={{ color: colors.text }}>{fill(t.greeting, { name })}</Text>
          <Text style={{ color: colors.text }}>{t.body[kind]}</Text>
          <Text style={{ color: colors.muted }}>{fill(t.signoff, { brand: brand.name })}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const formConfirmationSubject = (kind: FormKind, locale: Locale = "en") =>
  fill(getMessages(locale).emails.formConfirmation.subject[kind], { brand: brand.name });
