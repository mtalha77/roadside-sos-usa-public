import { formatDateTime, type Locale } from "@rsos/i18n";

/** Account times are shown in UTC with the zone name: accounts are not tied to one market. */
export function when(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return formatDateTime(new Date(iso), locale as Locale, "UTC", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** A short, readable device name from a user agent (no fingerprinting, just a label). */
export function deviceLabel(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  return [browser, os].filter(Boolean).join(" · ") || null;
}
