import { getMessages, locales } from "@rsos/i18n";
import { describe, expect, it } from "vitest";

describe("admin app messages", () => {
  it("has every string the placeholder page needs, in every locale", () => {
    for (const locale of locales) {
      const m = getMessages(locale);
      for (const key of ["label", "headline", "body", "cta"] as const) {
        expect(m.admin[key].length).toBeGreaterThan(0);
      }
    }
  });
});
