/**
 * Legal documents and their current versions. A consent record stores the version the person saw
 * (RSOS-028). Bump the version when a document's wording changes; old versions stay valid for the
 * consents that reference them. Every document is a draft until a US attorney has reviewed it.
 */
export const legalDocuments = {
  "driver-terms": { version: "2026-11-13-draft" },
  "provider-terms": { version: "2026-11-13-draft" },
  privacy: { version: "2026-11-13-draft" },
  "sms-terms": { version: "2026-11-13-draft" },
  "call-recording": { version: "2026-11-13-draft" },
  cookies: { version: "2026-11-13-draft" },
  accessibility: { version: "2026-11-13-draft" },
} as const;

export type LegalDocument = keyof typeof legalDocuments;
export const LEGAL_DOCUMENTS = Object.keys(legalDocuments) as LegalDocument[];
