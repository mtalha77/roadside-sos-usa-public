import { notFound } from "next/navigation";
import { ContentStub } from "@/components/site/content-stub";

export const dynamic = "force-dynamic";

const DOCS: Record<string, string> = {
  "driver-terms": "footer.driverTerms",
  "provider-terms": "footer.providerTerms",
  privacy: "footer.privacy",
  "sms-terms": "footer.smsTerms",
  "call-recording": "footer.callRecording",
  cookies: "footer.cookies",
  accessibility: "footer.accessibility",
};

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const key = DOCS[(await params).doc];
  if (!key) notFound();
  return <ContentStub titleKey={key} />;
}
