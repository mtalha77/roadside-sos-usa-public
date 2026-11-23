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

/**
 * The head script plus, when a GTM container is configured, Google Tag Manager loaded only after
 * the visitor allowed analytics or advertising (never before a choice, never with only necessary
 * cookies). Tap-to-call links push a "call_click" event for the call conversion (RSOS-031).
 * `nonce` lets GTM's own script run under our CSP ('strict-dynamic').
 */
export function consentHeadScript(gtmId: string | null, nonce: string): string {
  const id = gtmId && /^GTM-[A-Z0-9]{4,12}$/.test(gtmId) ? gtmId : null;
  const loader = id
    ? `try{var k=document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]+)/);if(k){var x=JSON.parse(decodeURIComponent(k[1]));if(x.a||(x.d&&navigator.globalPrivacyControl!==true)){dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var s=document.createElement('script');s.async=true;s.nonce=${JSON.stringify(nonce)};s.src='https://www.googletagmanager.com/gtm.js?id=${id}';document.head.appendChild(s);}}}catch(e){}`
    : "";
  const calls = `document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href^="tel:"]');if(a)dataLayer.push({event:'call_click',market:a.getAttribute('data-dni')||''});},true);`;
  return CONSENT_HEAD_SCRIPT + loader + calls;
}
