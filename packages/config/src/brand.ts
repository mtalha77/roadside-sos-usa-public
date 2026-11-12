/**
 * Brand configuration: the ONLY place the brand name and domain are written down.
 * Both are working values and will change; never hardcode them anywhere else.
 * Phone numbers and cities are NOT brand config: they belong to a market in the database.
 */
const domain = "fixallcontractors.com";

export const brand = {
  /** Full product name shown in titles and headings. */
  name: "Roadside SOS USA",
  /** Short name for tight spaces (mobile header, PWA name). */
  shortName: "Roadside SOS",
  tagline: "Roadside help, fast",
  domain,
  urls: {
    web: `https://${domain}`,
    provider: `https://providers.${domain}`,
    admin: `https://admin.${domain}`,
  },
  emails: {
    support: `support@${domain}`,
    noReply: `no-reply@${domain}`,
  },
} as const;

export type Brand = typeof brand;
