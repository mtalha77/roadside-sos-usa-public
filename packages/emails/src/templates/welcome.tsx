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

export type WelcomeEmailProps = {
  firstName: string;
};

/** Starter template. Real transactional emails are added with the features that send them. */
export function WelcomeEmail({ firstName }: WelcomeEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Welcome to ${brand.name}`}</Preview>
      <Body style={{ backgroundColor: "#f6f6f4", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px" }}>
          <Heading as="h1" style={{ fontSize: "24px", color: "#1f2330" }}>
            {`Welcome to ${brand.name}, ${firstName}`}
          </Heading>
          <Section>
            <Text style={{ fontSize: "16px", lineHeight: "24px", color: "#1f2330" }}>
              {brand.tagline}.
            </Text>
            <Text style={{ fontSize: "14px", color: "#4b5060" }}>
              Questions? Email{" "}
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
