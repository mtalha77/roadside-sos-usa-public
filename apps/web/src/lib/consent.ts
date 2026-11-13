import { legalDocuments } from "@rsos/config/legal";

/** First-party cookie holding the visitor's choices (read by the head script and the banner). */
export const CONSENT_COOKIE = "rsos_consent";
/** Random, non-personal browser id used only to store consent records. */
export const BROWSER_ID_COOKIE = "rsos_bid";
export const CONSENT_MAX_AGE = 365 * 24 * 3600;
export const COOKIE_POLICY_VERSION = legalDocuments.cookies.version;

/** Stored form: short keys to keep the cookie small. a = analytics, d = advertising. */
export type ConsentChoice = { v: string; a: boolean; d: boolean; gpc: boolean };

export function parseConsent(raw: string | undefined | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentChoice>;
    if (typeof v.v !== "string" || typeof v.a !== "boolean" || typeof v.d !== "boolean")
      return null;
    return { v: v.v, a: v.a, d: v.d, gpc: v.gpc === true };
  } catch {
    return null;
  }
}

/** A choice made under an older cookie policy version asks again. */
export const needsChoice = (c: ConsentChoice | null) => !c || c.v !== COOKIE_POLICY_VERSION;

/** Google Consent Mode v2 values for a choice. A Global Privacy Control signal always blocks ads. */
export function consentModeState(c: Pick<ConsentChoice, "a" | "d">, gpc: boolean) {
  const ads = c.d && !gpc ? "granted" : "denied";
  return {
    analytics_storage: c.a ? "granted" : "denied",
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  } as const;
}

/**
 * Runs first in <head>: every Google tag starts denied (Consent Mode v2 defaults) and a stored
 * choice is applied before any tag could load. Plain ES5, no dependencies.
 */
export const CONSENT_HEAD_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});try{var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]+)/);if(m){var c=JSON.parse(decodeURIComponent(m[1]));var g=navigator.globalPrivacyControl===true;var d=c.d&&!g?'granted':'denied';gtag('consent','update',{analytics_storage:c.a?'granted':'denied',ad_storage:d,ad_user_data:d,ad_personalization:d});}}catch(e){}`;
