import { describe, expect, it } from "vitest";
import {
  canManageRole,
  canOpenPath,
  canSee,
  maskPhone,
  masksCustomerData,
  sectionForPath,
  STAFF_ROLES,
} from "../src/permissions";

describe("roles and permissions (RSOS-102)", () => {
  it("matches the batch's role table", () => {
    expect(canSee("dispatcher", "inbox")).toBe(true);
    expect(canSee("dispatcher", "providers")).toBe(true);
    for (const s of ["finance", "pricing", "content", "settings", "team"] as const)
      expect(canSee("dispatcher", s)).toBe(false);
    expect(canSee("support", "recruitment")).toBe(true);
    expect(canSee("support", "markets")).toBe(true);
    expect(canSee("support", "finance")).toBe(false);
    expect(canSee("finance", "finance")).toBe(true);
    expect(canSee("finance", "requests")).toBe(true);
    expect(canSee("finance", "dispatch")).toBe(false);
    expect(canSee("marketing", "content")).toBe(true);
    expect(canSee("marketing", "campaign")).toBe(true);
    expect(canSee("marketing", "requests")).toBe(false);
    expect(canSee("read_only", "analytics")).toBe(true);
    expect(canSee("read_only", "inbox")).toBe(false);
    expect(canSee("ops_manager", "team")).toBe(true);
  });

  it("owners see every section; unknown roles see nothing", () => {
    for (const s of ["inbox", "finance", "team", "settings", "content"] as const)
      expect(canSee("super_admin", s)).toBe(true);
    expect(canSee("", "today")).toBe(false);
    expect(canSee("driver", "today")).toBe(false);
  });

  it("guards paths, including APIs and nested pages", () => {
    expect(sectionForPath("/finance/ledger")).toBe("finance");
    expect(sectionForPath("/api/board")).toBe("dispatch");
    expect(sectionForPath("/staff")).toBe("team");
    expect(sectionForPath("/sign-in")).toBeNull();
    expect(canOpenPath("dispatcher", "/finance")).toBe(false);
    expect(canOpenPath("dispatcher", "/api/board")).toBe(true);
    expect(canOpenPath("marketing", "/api/board")).toBe(false);
    expect(canOpenPath("marketing", "/no-access")).toBe(true);
    expect(canOpenPath("read_only", "/")).toBe(true);
  });

  it("only owners manage owners, and ops managers manage everyone else", () => {
    expect(canManageRole("super_admin", "super_admin")).toBe(true);
    expect(canManageRole("ops_manager", "super_admin")).toBe(false);
    for (const r of STAFF_ROLES.filter((x) => x !== "super_admin"))
      expect(canManageRole("ops_manager", r)).toBe(true);
    expect(canManageRole("dispatcher", "dispatcher")).toBe(false);
  });

  it("masks customer contact details for marketing and viewers", () => {
    expect(masksCustomerData("marketing")).toBe(true);
    expect(masksCustomerData("read_only")).toBe(true);
    expect(masksCustomerData("dispatcher")).toBe(false);
    expect(maskPhone("+12105550123")).toBe("(210) •••-••23");
    expect(maskPhone("12")).toBe("•••");
  });
});
