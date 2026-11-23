import type { Locale } from "./index";

/**
 * Formatting by locale AND market time zone. Times shown to a driver or provider are always in
 * the market's zone (e.g. America/Phoenix), never the server's or the viewer's device zone.
 */
const intlLocale: Record<Locale, string> = { en: "en-US", es: "es-US" };

export function formatCurrency(cents: number, locale: Locale, currency = "USD"): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "$50–$150" style range in whole dollars. */
export function formatPriceRange(
  minCents: number,
  maxCents: number,
  locale: Locale,
  currency = "USD",
): string {
  const f = new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return f.formatRange(minCents / 100, maxCents / 100);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale[locale], options).format(value);
}

export function formatDateTime(
  date: Date | number,
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { ...options, timeZone }).format(date);
}

export function formatTime(date: Date | number, locale: Locale, timeZone: string): string {
  return formatDateTime(date, locale, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** "in 12 minutes", "hace 3 minutos". */
export function formatRelative(target: Date | number, now: Date | number, locale: Locale): string {
  const diffSeconds = Math.round((Number(target) - Number(now)) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto" });
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(diffSeconds, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  return rtf.format(Math.round(diffSeconds / 86400), "day");
}

/** Name of the locale cookie set by the language switcher. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
