import { getMessages, locales } from "@rsos/i18n";
import { describe, expect, it } from "vitest";

describe("provider app messages", () => {
  it("has every string the placeholder page needs, in every locale", () => {
    for (const locale of locales) {
      const m = getMessages(locale);
      for (const key of ["label", "headline", "body", "cta"] as const) {
        expect(m.provider[key].length).toBeGreaterThan(0);
      }
    }
  });
});
