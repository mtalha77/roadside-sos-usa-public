/**
 * Brand configuration: the ONLY place the brand name and default domain are written down.
 * Name: Road Rescue SOS (owner, 2026-11-23). Main domain: roadrescuesos.com. The old test domain
 * (LEGACY_DOMAINS) only answers with permanent redirects (RSOS-118). Change the name here; change the domain with the
 * NEXT_PUBLIC_APP_DOMAIN environment variable (no code edit). Never hardcode either elsewhere:
 * `node scripts/check-brand.ts` fails CI if you do.
 * Phone numbers and cities are NOT brand config: they belong to a market in the database.
 */
import { iconColors } from "./theme-colors";

const DEFAULT_DOMAIN = "roadrescuesos.com";

/**
 * Domains the product used before (RSOS-118). Every URL on them, any subdomain, answers with a
 * permanent 301 to the same subdomain and path on the main domain (`legacyRedirect`). Keep them
 * until at least 2027-11-24 (12 months), then remove them here and in Vercel.
 */
export const LEGACY_DOMAINS: readonly string[] = ["fixallcontractors.com"];

/** Names the product used before; no page, email or metadata may show them (brand scan tests). */
export const LEGACY_NAMES: readonly string[] = ["Roadside SOS USA", "Roadside SOS"];

/** Matches any legacy name or domain (case-insensitive), for the brand scan tests. */
export const LEGACY_BRAND_PATTERN = new RegExp(
  [...LEGACY_NAMES, ...LEGACY_DOMAINS.map((d) => d.split(".")[0]!)]
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s_-]*"))
    .join("|"),
  "i",
);

const domain = (process.env.NEXT_PUBLIC_APP_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();

export const brand = {
  /** Full product name shown in titles, headings and footers. */
  name: "Road Rescue SOS",
  /** Short name for tight spaces (mobile header, app icon, PWA name). */
  shortName: "Road Rescue",
  /** Legal entity for terms, privacy and invoices. Placeholder until the company is formed. */
  legalName: "Road Rescue SOS LLC (placeholder)",
  tagline: "Roadside help, fast",
  description:
    "Stranded? Share your location and problem, get quotes with price and arrival time from verified roadside providers nearby, and pick one.",
  domain,
  /**
   * PRODUCTION URLs of the three apps. Never build links from these: links must follow the
   * current environment, so use `appUrl()` from `@rsos/config/site` (a test enforces this).
   */
  urls: {
    web: process.env.NEXT_PUBLIC_WEB_URL || `https://${domain}`,
    provider: process.env.NEXT_PUBLIC_PROVIDER_URL || `https://pro.${domain}`,
    admin: process.env.NEXT_PUBLIC_ADMIN_URL || `https://admin.${domain}`,
  },
  emails: {
    support: `support@${domain}`,
    /** Sender address: the `mail.` subdomain is the one verified in Resend (root stays clean). */
    noReply: `no-reply@mail.${domain}`,
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
