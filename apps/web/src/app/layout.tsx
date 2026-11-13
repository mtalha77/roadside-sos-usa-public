import { buildMetadata } from "@rsos/config/metadata";
import { themeColor } from "@rsos/config/theme-colors";
import { getSiteEnv } from "@rsos/config/site";
import { ThemeProvider } from "@rsos/ui/theme-provider";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ConsentManager, type ConsentLabels } from "@/components/site/consent-manager";
import { CONSENT_HEAD_SCRIPT } from "@/lib/consent";
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

const CONSENT_KEYS = [
  "title",
  "body",
  "necessary",
  "necessaryHint",
  "analytics",
  "analyticsHint",
  "ads",
  "adsHint",
  "gpc",
  "acceptAll",
  "rejectAll",
  "save",
  "manage",
  "policy",
  "saved",
] as const;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const tc = await getTranslations("consent");
  return (
    <html lang={locale} className={GeistSans.variable} suppressHydrationWarning>
      <head>
        {/* Consent Mode defaults run before anything else: Google tags start denied (RSOS-028). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: CONSENT_HEAD_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
        {/* Analytics load only after consent, and only in production (no preview or staging noise). */}
        <ConsentManager
          analyticsTags={getSiteEnv() === "production"}
          labels={Object.fromEntries(CONSENT_KEYS.map((k) => [k, tc(k)])) as ConsentLabels}
        />
      </body>
    </html>
  );
}
