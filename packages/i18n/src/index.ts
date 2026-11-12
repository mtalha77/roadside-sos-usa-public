import en from "../messages/en.json";
import es from "../messages/es.json";

/** English ships first; Spanish is wired up and must keep the same keys. */
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export type Messages = typeof en;

const catalog: Record<Locale, Messages> = { en, es };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return catalog[locale];
}
