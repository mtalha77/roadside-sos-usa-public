import { buildMetadata } from "@rsos/config/metadata";
import { themeColor } from "@rsos/config/theme-colors";
import { getSiteEnv } from "@rsos/config/site";
import { ThemeProvider } from "@rsos/ui/theme-provider";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ConsentManager } from "@/components/site/consent-manager";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Consent Mode defaults run before anything else: Google tags start denied (RSOS-028). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: CONSENT_HEAD_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider nonce={nonce}>{children}</ThemeProvider>
          {/* Analytics load only after consent, and only in production (no preview or staging noise). */}
          <ConsentManager analyticsTags={getSiteEnv() === "production"} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
