import { describe, expect, it } from "vitest";
import { sentryStatus } from "../src/lib/sentry-status";

const app = (sentry: "real" | "fake" | "missing") => ({
  adapters: { sentry } as Record<string, "real" | "fake" | "missing">,
});

describe("Sentry live check (owner decision, release 1)", () => {
  it("is live only when all three apps report Sentry as real", () => {
    expect(sentryStatus({ web: app("real"), provider: app("real"), admin: app("real") })).toEqual({
      ok: true,
      detail: null,
    });
  });

  it("names every app that is not live, including unreachable ones", () => {
    expect(sentryStatus({ web: app("missing"), provider: null, admin: app("real") })).toEqual({
      ok: false,
      detail: "web: missing, provider: unreachable",
    });
  });
});
