import { describe, expect, it } from "vitest";
import { getMessages, locales } from "../src";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("message catalogs", () => {
  it("every locale has exactly the same keys as English", () => {
    const english = keyPaths(getMessages("en")).sort();
    for (const locale of locales) {
      expect(keyPaths(getMessages(locale)).sort()).toEqual(english);
    }
  });

  it("has no empty strings", () => {
    for (const locale of locales) {
      const flat = JSON.stringify(getMessages(locale));
      expect(flat).not.toMatch(/:""/);
    }
  });
});
