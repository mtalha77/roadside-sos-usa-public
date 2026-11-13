import { brand } from "./brand";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Two-letter monogram from the short name, e.g. "Acme Tow" -> "AT". */
export function brandInitials(name: string = brand.shortName): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return letters.slice(0, 2).join("") || "?";
}

/**
 * Placeholder wordmark generated from the brand name: an icon square with the initials
 * followed by the name. `currentColor` follows the surrounding text colour (light/dark).
 */
export function wordmarkSvg(name: string = brand.name, accent: string = brand.color): string {
  const safeName = escapeXml(name);
  const initials = escapeXml(brandInitials());
  const width = 64 + Math.round(name.length * 17.5);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 56" width="${width}" height="56" role="img" aria-label="${safeName}">`,
    `<rect x="0" y="4" width="48" height="48" rx="12" fill="${accent}"/>`,
    `<text x="24" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="${brand.colorForeground}">${initials}</text>`,
    `<text x="60" y="37" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="currentColor">${safeName}</text>`,
    `</svg>`,
  ].join("");
}
