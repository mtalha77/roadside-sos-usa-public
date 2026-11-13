import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_SECONDS,
  adminAccess,
  parseClaims,
  providerAccess,
  staffCanAccessMarket,
} from "../src/claims";

const now = 1_800_000_000;
const staff = (over: Record<string, unknown> = {}) =>
  parseClaims({
    sub: "u1",
    app_role: "staff",
    staff_role: "dispatcher",
    aal: "aal2",
    amr: [
      { method: "password", timestamp: now - 60 },
      { method: "totp", timestamp: now - 30 },
    ],
    staff_markets: ["houston-id"],
    ...over,
  });

describe("admin access", () => {
  it("requires a session", () => expect(adminAccess(null, now)).toBe("sign-in"));
  it("refuses non-staff", () =>
    expect(adminAccess(parseClaims({ sub: "u", app_role: "provider", providers: [] }), now)).toBe(
      "forbidden",
    ));
  it("requires the authenticator second step (aal2)", () => {
    expect(
      adminAccess(staff({ aal: "aal1", amr: [{ method: "password", timestamp: now - 60 }] }), now),
    ).toBe("second-step");
  });
  it("allows staff with aal2", () => expect(adminAccess(staff(), now)).toBe("ok"));
  it("ends sessions after 12 hours", () => {
    const old = staff({
      amr: [
        { method: "password", timestamp: now - ADMIN_SESSION_SECONDS - 1 },
        { method: "totp", timestamp: now - 10 },
      ],
    });
    expect(adminAccess(old, now)).toBe("expired");
  });
});

describe("provider access", () => {
  const provider = (role: string, ageSeconds: number) =>
    parseClaims({
      sub: "p",
      app_role: "provider",
      providers: [{ provider_id: "x", role }],
      amr: [{ method: "password", timestamp: now - ageSeconds }],
    });
  it("allows members for up to 30 days", () => {
    expect(providerAccess(provider("operator", 29 * 86400), now)).toBe("ok");
    expect(providerAccess(provider("owner", 31 * 86400), now)).toBe("expired");
  });
  it("refuses staff and drivers", () => {
    expect(providerAccess(staff(), now)).toBe("forbidden");
    expect(providerAccess(null, now)).toBe("sign-in");
  });
});

describe("market scope", () => {
  it("limits staff to their markets", () => {
    expect(staffCanAccessMarket(staff()!, "houston-id")).toBe(true);
    expect(staffCanAccessMarket(staff()!, "san-antonio-id")).toBe(false);
    expect(staffCanAccessMarket(staff({ staff_markets: null })!, "san-antonio-id")).toBe(true);
    expect(staffCanAccessMarket(staff({ aal: "aal1" })!, "houston-id")).toBe(false);
  });
  it("rejects malformed claims", () => expect(parseClaims({ app_role: "root" })).toBeNull());
});
