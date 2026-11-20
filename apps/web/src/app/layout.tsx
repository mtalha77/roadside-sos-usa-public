import { buildMetadata } from "@rsos/config/metadata";
import { LastPage } from "@/components/get-help/flow";
import { themeColor } from "@rsos/config/theme-colors";
import { getSiteEnv } from "@rsos/config/site";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { isDemoMode } from "@rsos/config/demo";
import { DemoBadge } from "@rsos/ui/demo-badge";
import { cookies } from "next/headers";
import { ConsentBanner } from "@/components/site/consent-banner";
import { CONSENT_COOKIE, consentHeadScript, parseConsent } from "@/lib/consent";
import { SITE_SCRIPT } from "@/lib/site-script";
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
        {/* Theme (with the night default), menus and the phone action bar: no bundle (RSOS-100). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SITE_SCRIPT }} />
        {/* Consent Mode defaults run before anything else: Google tags start denied (RSOS-028). */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: consentHeadScript(process.env.NEXT_PUBLIC_GTM_ID ?? null, nonce ?? ""),
          }}
        />
      </head>
      <body>
        {isDemoMode() ? <DemoBadge label={demoLabel} strip /> : null}
        <LastPage />
        {children}
        <ConsentBanner />
        {analytics ? <VercelAnalytics /> : null}
      </body>
    </html>
  );
}

/**
 * Vercel Analytics and Speed Insights, imported only when they are used (production, with
 * analytics consent), so their script is not in every visitor's download (RSOS-100 budget).
 */
async function VercelAnalytics() {
  const [{ Analytics }, { SpeedInsights }] = await Promise.all([
    import("@vercel/analytics/next"),
    import("@vercel/speed-insights/next"),
  ]);
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
