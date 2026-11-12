import { describe, expect, it } from "vitest";

// RSOS-003 CI check: this test fails on purpose to prove a failing check blocks merging.
// The pull request that adds it is closed without merging.
describe("CI check", () => {
  it("fails on purpose", () => {
    expect(1 + 1).toBe(3);
  });
});
