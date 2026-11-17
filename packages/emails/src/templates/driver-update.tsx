import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { brand } from "@rsos/config/brand";
import { fill, getMessages } from "@rsos/i18n";

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export type DriverUpdate =
  | {
      kind: "assigned";
      firstName: string;
      provider: string;
      price: string;
      eta: number;
      link: string;
    }
  | { kind: "locationLink"; firstName: string; link: string };

export const driverUpdateSubject = (u: DriverUpdate) =>
  fill(getMessages("en").emails.driverUpdate.subject[u.kind], { brand: brand.shortName });

/**
 * To the driver, when they gave an email (batch 4 scope change: no SMS). Sent through the product
 * email adapter (the Resend fake until the final domain). Without an email the dispatcher reads
 * the same words on the call.
 */
export function DriverUpdateEmail(u: DriverUpdate) {
  const t = getMessages("en").emails.driverUpdate;
  const subject = driverUpdateSubject(u);
  const body =
    u.kind === "assigned"
      ? fill(t.body.assigned, {
          first_name: u.firstName,
          provider: u.provider,
          price: u.price,
          eta: String(u.eta),
        })
      : fill(t.body.locationLink, { first_name: u.firstName });
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Text style={{ color: colors.text }}>{body}</Text>
          <Text style={{ color: colors.text }}>{fill(t.open, { url: u.link })}</Text>
          <Text style={{ color: colors.muted }}>{t.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
