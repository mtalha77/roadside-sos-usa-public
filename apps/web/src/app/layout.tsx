import { buildMetadata } from "@rsos/config/metadata";
import { themeColor } from "@rsos/config/theme-colors";
import { getSiteEnv } from "@rsos/config/site";
import { ThemeProvider } from "@rsos/ui/theme-provider";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { isDemoMode } from "@rsos/config/demo";
import { DemoBadge } from "@rsos/ui/demo-badge";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { cookies } from "next/headers";
import { ConsentBanner } from "@/components/site/consent-banner";
import { CONSENT_COOKIE, CONSENT_HEAD_SCRIPT, parseConsent } from "@/lib/consent";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("web");
  return buildMetadata({ app: "web", title: t("label"), description: t("body") });
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: themeColor.dark },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const demoLabel = (await getTranslations("demo"))("badge");
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  // Analytics only after analytics consent, and only in production (no preview or staging noise).
  const analytics = getSiteEnv() === "production" && consent?.a === true;
  return (
    <html lang={locale} className={GeistSans.variable} suppressHydrationWarning>
      <head>
        {/* Consent Mode defaults run before anything else: Google tags start denied (RSOS-028). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: CONSENT_HEAD_SCRIPT }} />
      </head>
      <body>
        {isDemoMode() ? <DemoBadge label={demoLabel} /> : null}
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
        <ConsentBanner />
        {analytics ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
