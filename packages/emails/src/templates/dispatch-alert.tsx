import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { brand } from "@rsos/config/brand";
import { fill, getMessages } from "@rsos/i18n";

const colors = { page: "#f6f7f9", card: "#ffffff", text: "#1d2029", muted: "#4f5563" };

export type DispatchAlert = {
  kind: "missed" | "voicemail";
  caller: string;
  market: string;
  inboxUrl: string;
  transcript?: string | null;
};

export const dispatchAlertSubject = (a: DispatchAlert) =>
  fill(getMessages("en").emails.dispatchAlert.subject[a.kind], {
    brand: brand.shortName,
    caller: a.caller,
    market: a.market,
  });

/** To on-duty dispatchers (RSOS-030): a missed call or a voicemail waiting in the inbox. */
export function DispatchAlertEmail(a: DispatchAlert) {
  const t = getMessages("en").emails.dispatchAlert;
  const subject = dispatchAlertSubject(a);
  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={{ backgroundColor: colors.page, fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: colors.card, padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "22px", color: colors.text }}>
            {subject}
          </Heading>
          <Text style={{ color: colors.text }}>{fill(t.body[a.kind], { caller: a.caller })}</Text>
          {a.transcript ? (
            <Text style={{ color: colors.muted }}>
              {fill(t.transcript, { text: a.transcript })}
            </Text>
          ) : null}
          <Text style={{ color: colors.text }}>{fill(t.open, { url: a.inboxUrl })}</Text>
        </Container>
      </Body>
    </Html>
  );
}
