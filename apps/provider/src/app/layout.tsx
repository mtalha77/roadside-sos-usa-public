import { brand } from "@rsos/config/brand";
import { ThemeProvider } from "@rsos/ui/theme-provider";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("provider");
  return {
    title: { default: `${t("label")} | ${brand.name}`, template: `%s | ${brand.name}` },
    description: t("body"),
    applicationName: brand.name,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfa" },
    { media: "(prefers-color-scheme: dark)", color: "#16181f" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
