/**
 * Brand configuration: the ONLY place the brand name and default domain are written down.
 * Both are working values and will change. Change the name here; change the domain with the
 * NEXT_PUBLIC_APP_DOMAIN environment variable (no code edit). Never hardcode either elsewhere:
 * `node scripts/check-brand.ts` fails CI if you do.
 * Phone numbers and cities are NOT brand config: they belong to a market in the database.
 */
import { iconColors } from "./theme-colors";

const DEFAULT_DOMAIN = "fixallcontractors.com";

const domain = (process.env.NEXT_PUBLIC_APP_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();

export const brand = {
  /** Full product name shown in titles, headings and footers. */
  name: "Roadside SOS USA",
  /** Short name for tight spaces (mobile header, app icon, PWA name). */
  shortName: "Roadside SOS",
  /** Legal entity for terms, privacy and invoices. Placeholder until the company is formed. */
  legalName: "Roadside SOS USA LLC (placeholder)",
  tagline: "Roadside help, fast",
  description:
    "Stranded? Share your location and problem, get quotes with price and arrival time from verified roadside providers nearby, and pick one.",
  domain,
  /** Production URLs. Each can be overridden per environment (staging, previews) by env vars. */
  urls: {
    web: process.env.NEXT_PUBLIC_WEB_URL || `https://${domain}`,
    provider: process.env.NEXT_PUBLIC_PROVIDER_URL || `https://pro.${domain}`,
    admin: process.env.NEXT_PUBLIC_ADMIN_URL || `https://admin.${domain}`,
  },
  emails: {
    support: `support@${domain}`,
    noReply: `no-reply@${domain}`,
  },
  /** Social profiles. Empty until the accounts exist; components skip empty links. */
  social: {
    facebook: "",
    instagram: "",
    x: "",
    linkedin: "",
    youtube: "",
  },
  /** Logo paths served by every app (generated from the name, see logo.ts). */
  logos: {
    wordmark: "/logo.svg",
    icon: "/icon",
    appleIcon: "/apple-icon",
  },
  /** Signal colour (safety amber, from the design tokens) for the generated icon and wordmark. */
  color: iconColors.background,
  colorForeground: iconColors.foreground,
} as const;

export type Brand = typeof brand;
