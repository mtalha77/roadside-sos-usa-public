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

export * from "./format";

/** Picks the locale from the cookie value, else the default. */
export function resolveLocale(cookieValue: string | undefined | null): Locale {
  return cookieValue && isLocale(cookieValue) ? cookieValue : defaultLocale;
}

/** Fills {placeholders} in a message (for non-React contexts such as emails and SMS). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
