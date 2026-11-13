import { describe, expect, it } from "vitest";
import {
  CONSENT_HEAD_SCRIPT,
  consentModeState,
  COOKIE_POLICY_VERSION,
  needsChoice,
  parseConsent,
} from "../src/lib/consent";

describe("consent (RSOS-028)", () => {
  it("parses stored choices and asks again after a policy change", () => {
    const raw = encodeURIComponent(JSON.stringify({ v: COOKIE_POLICY_VERSION, a: true, d: false }));
    expect(parseConsent(raw)).toEqual({ v: COOKIE_POLICY_VERSION, a: true, d: false, gpc: false });
    expect(needsChoice(parseConsent(raw))).toBe(false);
    expect(needsChoice({ v: "1999-01-01", a: true, d: true, gpc: false })).toBe(true);
    expect(parseConsent("garbage")).toBeNull();
    expect(needsChoice(null)).toBe(true);
  });

  it("maps choices to Consent Mode; GPC always denies advertising", () => {
    expect(consentModeState({ a: true, d: true }, false)).toEqual({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    expect(consentModeState({ a: false, d: true }, true)).toMatchObject({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
    });
  });

  it("the head script sets every Google signal to denied before anything loads", () => {
    const layer: unknown[] = [];
    const win = { dataLayer: layer } as unknown as Window & { dataLayer: unknown[] };
    new Function("window", "document", "navigator", "dataLayer", CONSENT_HEAD_SCRIPT)(
      win,
      { cookie: "" },
      {},
      layer,
    );
    const [first] = layer as ArrayLike<unknown>[];
    expect(Array.from(first!)).toEqual([
      "consent",
      "default",
      expect.objectContaining({
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      }),
    ]);
  });
});
