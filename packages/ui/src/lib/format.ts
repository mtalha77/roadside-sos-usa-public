/** US phone helpers. Input may contain anything; output is display "(512) 555-0123" or E.164. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** National digits (10), dropping a leading US country code. */
export function nationalDigits(value: string): string {
  const d = digitsOnly(value);
  // Drop the US country code when typed as "+1..." or as an 11-digit number starting with 1.
  const hasCountryCode =
    (value.trim().startsWith("+1") || (d.length === 11 && d.startsWith("1"))) && d.startsWith("1");
  return (hasCountryCode ? d.slice(1) : d).slice(0, 10);
}

export function formatUsPhone(value: string): string {
  const d = nationalDigits(value);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** E.164 (+1XXXXXXXXXX) when complete, otherwise null. */
export function toE164(value: string): string | null {
  const d = nationalDigits(value);
  return d.length === 10 ? `+1${d}` : null;
}

/** Cents <-> display for USD. */
export function formatCents(cents: number | null, locale = "en-US"): string {
  if (cents === null || Number.isNaN(cents)) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseCents(value: string): number | null {
  const cleaned = value.replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}
