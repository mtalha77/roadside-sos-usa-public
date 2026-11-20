import { describe, expect, it } from "vitest";
import {
  effectsOf,
  questionsFor,
  SERVICE_QUESTIONS,
  tagsOf,
  validateAnswers,
} from "../src/service-questions";

// RSOS-116: per-service questions, required ones enforced, optional ones skippable.
const NOW = Date.UTC(2026, 10, 19, 12);

describe("questions per service", () => {
  it("every service has 1 to 4 required or quick questions after the common ones", () => {
    for (const [service, qs] of Object.entries(SERVICE_QUESTIONS)) {
      expect(qs.length, service).toBeGreaterThan(0);
      expect(qs.filter((q) => q.required).length, service).toBeLessThanOrEqual(4);
    }
    expect(
      questionsFor("flat-tire")
        .map((q) => q.id)
        .slice(0, 4),
    ).toEqual(["safety", "when", "whenAt", "people"]);
  });

  it("required questions are enforced, optional ones skippable", () => {
    expect(validateAnswers("flat-tire", { safety: "safe", flats: "one" }, [], NOW)).toEqual({
      ok: false,
      missing: ["spare"],
    });
    expect(
      validateAnswers("flat-tire", { safety: "safe", flats: "one", spare: "full" }, [], NOW),
    ).toEqual({
      ok: true,
      answers: { safety: "safe", when: "now", flats: "one", spare: "full" },
    });
  });

  it("values must be one of the options or in range", () => {
    const r = validateAnswers(
      "tow",
      { safety: "safe", vehicleType: "boat", rolls: "yes", accident: "no", riders: "5" },
      [],
      NOW,
    );
    expect(r).toEqual({ ok: false, missing: ["vehicleType"] });
    const ok = validateAnswers(
      "tow",
      { safety: "safe", vehicleType: "car", rolls: "yes", accident: "no", riders: "5" },
      [],
      NOW,
    );
    expect(ok.ok && ok.answers.riders).toBeUndefined();
  });

  it("follow-ups count only when shown", () => {
    const r = validateAnswers(
      "tow",
      { safety: "safe", vehicleType: "car", rolls: "yes", accident: "no", police: "yes" },
      [],
      NOW,
    );
    expect(r.ok && r.answers.police).toBeUndefined();
    expect(
      validateAnswers(
        "tow",
        { safety: "safe", when: "later", vehicleType: "car", rolls: "yes", accident: "no" },
        [],
        NOW,
      ),
    ).toEqual({
      ok: false,
      missing: ["whenAt"],
    });
    const later = validateAnswers(
      "tow",
      {
        safety: "safe",
        when: "later",
        whenAt: "2026-11-19T18:30",
        vehicleType: "car",
        rolls: "yes",
        accident: "no",
      },
      [],
      NOW,
    );
    expect(later.ok).toBe(true);
  });
});

describe("effects and tags", () => {
  it("in a traffic lane and a child or pet inside show the 911 banner and mark it urgent", () => {
    expect(effectsOf("tow", { safety: "lane" })).toEqual(["call911", "urgent"]);
    expect(effectsOf("locked-out", { safety: "safe", childInside: "yes" })).toEqual([
      "call911",
      "urgent",
    ]);
    expect(effectsOf("locked-out", { safety: "safe", childInside: "no" })).toEqual([]);
  });

  it("suggestions: two flats or no spare suggest Tow; an EV can't be jump started", () => {
    expect(effectsOf("flat-tire", { flats: "twoPlus" })).toEqual(["suggestTow"]);
    expect(effectsOf("flat-tire", { spare: "none" })).toEqual(["suggestTow"]);
    expect(effectsOf("wont-start", { electric: "yes" })).toEqual(["evNoJump"]);
    expect(effectsOf("out-of-gas", { fuel: "electric" })).toEqual(["evCharge"]);
    expect(effectsOf("tow", { parked: "offroad" })).toEqual(["suggestWinch"]);
  });

  it("tags for the provider, most important first", () => {
    expect(
      tagsOf("tow", {
        safety: "shoulder",
        vehicleType: "car",
        rolls: "no",
        awd: "yes",
        accident: "yes",
        police: "yes",
      }),
    ).toEqual(["accident", "flatbed", "noRoll", "shoulder", "police"]);
    expect(
      tagsOf("locked-out", { safety: "safe", childInside: "yes", keysWhere: "inside" }),
    ).toEqual(["childInside"]);
  });
});

describe("admin overrides per market", () => {
  it("hide, make optional or reorder a question; safety can never be hidden", () => {
    const o = [
      { service: "flat-tire", questionId: "whichTire", hidden: true, required: null, sort: null },
      { service: "flat-tire", questionId: "spare", hidden: false, required: false, sort: -1 },
      { service: "*", questionId: "safety", hidden: true, required: false, sort: null },
    ];
    const ids = questionsFor("flat-tire", o).map((q) => q.id);
    expect(ids[0]).toBe("spare");
    expect(ids).not.toContain("whichTire");
    expect(ids).toContain("safety");
    expect(questionsFor("flat-tire", o).find((q) => q.id === "safety")?.required).toBe(true);
    expect(validateAnswers("flat-tire", { safety: "safe", flats: "one" }, o, NOW).ok).toBe(true);
  });
});

describe("demo answers", () => {
  it("demo requests carry answers, some of them with tags, never the 911 ones", async () => {
    const { demoStream } = await import("../src/demo");
    const list = demoStream(Date.UTC(2026, 10, 19, 12), { markets: ["houston"], intervalSec: 30 });
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((r) => r.answers.safety && r.answers.safety !== "lane")).toBe(true);
    expect(list.every((r) => r.answers.childInside !== "yes")).toBe(true);
    expect(list.some((r) => tagsOf(r.serviceSlug, r.answers).length > 0)).toBe(true);
  });
});
