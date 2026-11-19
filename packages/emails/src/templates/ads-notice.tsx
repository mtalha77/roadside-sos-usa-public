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

export type AdsNoticeProps = { title: string; lines: string[] };

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029" };

/**
 * An owner notice from the ad sync (RSOS-107): campaigns paused or resumed, a sync failing three
 * times in a row, and the daily summary. The caller passes text from `emails.ads` in packages/i18n.
 */
export function AdsNoticeEmail({ title, lines }: AdsNoticeProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {title}
          </Heading>
          <Section>
            {lines.filter(Boolean).map((l, i) => (
              <Text key={i} style={{ color: colors.text }}>
                {l}
              </Text>
            ))}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
