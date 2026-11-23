import { z } from "zod";

/**
 * Get Help questions per service (RSOS-116). Every request asks the common questions; each service
 * adds 1 to 4 quick tap questions on screen 1 (tow's destination is asked on the location screen).
 * Answers are stored as structured JSON with `QUESTIONS_VERSION`, so questions can change later
 * without breaking old requests. Labels live in `packages/i18n` under `getHelp.q.<id>`; the admin
 * can hide a question, make it required or optional, or reorder it per market (overrides).
 */
export const QUESTIONS_VERSION = 1;

/** What an answer causes on the screen and for the provider. */
export type Effect =
  | "call911" // red "Call 911 now" banner with a call button (the customer can still continue)
  | "urgent" // the request is marked urgent
  | "suggestTow" // suggests switching to Tow
  | "suggestWinch" // suggests winch-out
  | "evNoJump" // most EVs can't be jump started: tow or mobile charger
  | "evCharge"; // out of charge: tow or mobile charger

export type Question = {
  id: string;
  kind: "chips" | "count" | "datetime" | "text";
  options?: readonly string[];
  required: boolean;
  /** Pre-selected option (for "When do you need help?" it is "now"). */
  default?: string;
  min?: number;
  max?: number;
  /** Shown only when another answer has this value. */
  showIf?: { id: string; eq: string };
  /** Answer value to the effects it causes. */
  effects?: Record<string, readonly Effect[]>;
  /** Answer value to the short tag providers see ("Flatbed needed", "No spare"). */
  tags?: Record<string, string>;
};

const yes = ["yes", "no"] as const;
const yesNoUnsure = ["yes", "no", "unsure"] as const;

/** The questions every request asks (screen 1), whatever the service. */
export const COMMON_QUESTIONS: readonly Question[] = [
  {
    id: "safety",
    kind: "chips",
    options: ["safe", "shoulder", "lane"],
    required: true,
    effects: { lane: ["call911", "urgent"] },
    tags: { lane: "inLane", shoulder: "shoulder" },
  },
  {
    id: "when",
    kind: "chips",
    options: ["now", "later"],
    required: true,
    default: "now",
    tags: { later: "scheduled" },
  },
  { id: "whenAt", kind: "datetime", required: true, showIf: { id: "when", eq: "later" } },
  { id: "people", kind: "count", min: 0, max: 6, required: false },
];

export const SERVICE_QUESTIONS: Record<string, readonly Question[]> = {
  tow: [
    {
      id: "vehicleType",
      kind: "chips",
      options: ["car", "suv", "pickup", "van", "motorcycle", "rv"],
      required: true,
      tags: { motorcycle: "motorcycle", rv: "heavy" },
    },
    { id: "rolls", kind: "chips", options: yesNoUnsure, required: true, tags: { no: "noRoll" } },
    { id: "awd", kind: "chips", options: yesNoUnsure, required: false, tags: { yes: "flatbed" } },
    { id: "accident", kind: "chips", options: yes, required: true, tags: { yes: "accident" } },
    {
      id: "police",
      kind: "chips",
      options: yes,
      required: false,
      showIf: { id: "accident", eq: "yes" },
      tags: { yes: "police" },
    },
    { id: "keys", kind: "chips", options: yes, required: false, tags: { no: "noKeys" } },
    {
      id: "parked",
      kind: "chips",
      options: ["street", "lot", "garage", "offroad"],
      required: false,
      effects: { offroad: ["suggestWinch"] },
      tags: { garage: "garage", offroad: "offroad" },
    },
    {
      id: "heightLimit",
      kind: "text",
      max: 20,
      required: false,
      showIf: { id: "parked", eq: "garage" },
    },
    { id: "riders", kind: "count", min: 0, max: 2, required: false },
  ],
  "wont-start": [
    {
      id: "turnKey",
      kind: "chips",
      options: ["clicking", "nothing", "cranks", "unsure"],
      required: true,
      tags: { cranks: "cranks" },
    },
    {
      id: "electric",
      kind: "chips",
      options: yes,
      required: true,
      effects: { yes: ["evNoJump"] },
      tags: { yes: "ev" },
    },
    { id: "battery", kind: "chips", options: yes, required: false, tags: { yes: "battery" } },
  ],
  "flat-tire": [
    {
      id: "flats",
      kind: "chips",
      options: ["one", "twoPlus"],
      required: true,
      effects: { twoPlus: ["suggestTow"] },
      tags: { twoPlus: "twoFlats" },
    },
    { id: "whichTire", kind: "chips", options: ["fl", "fr", "rl", "rr"], required: false },
    {
      id: "spare",
      kind: "chips",
      options: ["full", "donut", "none", "unsure"],
      required: true,
      effects: { none: ["suggestTow"] },
      tags: { none: "noSpare", donut: "donut" },
    },
    {
      id: "wheelLock",
      kind: "chips",
      options: ["yes", "no", "none"],
      required: false,
      tags: { no: "noLockKey" },
    },
  ],
  "locked-out": [
    {
      id: "keysWhere",
      kind: "chips",
      options: ["inside", "lost", "broken", "trunk"],
      required: true,
      tags: { lost: "keysLost", broken: "keyBroken" },
    },
    {
      id: "childInside",
      kind: "chips",
      options: yes,
      required: true,
      effects: { yes: ["call911", "urgent"] },
      tags: { yes: "childInside" },
    },
    {
      id: "keyType",
      kind: "chips",
      options: ["regular", "fob", "push", "unsure"],
      required: false,
    },
  ],
  "out-of-gas": [
    {
      id: "fuel",
      kind: "chips",
      options: ["regular", "premium", "diesel", "electric"],
      required: true,
      effects: { electric: ["evCharge"] },
      tags: { diesel: "diesel", premium: "premium", electric: "evCharge" },
    },
    { id: "gallons", kind: "chips", options: ["2", "3", "5"], required: false, default: "2" },
  ],
  "winch-out": [
    {
      id: "stuckIn",
      kind: "chips",
      options: ["mud", "sand", "snow", "ditch", "other"],
      required: true,
    },
    {
      id: "distance",
      kind: "chips",
      options: ["lt10", "10to50", "gt50"],
      required: true,
      tags: { gt50: "farFromRoad" },
    },
    {
      id: "upright",
      kind: "chips",
      options: yes,
      required: true,
      effects: { no: ["suggestTow"] },
      tags: { no: "notUpright" },
    },
  ],
};

/** A market's (or every market's) change to a question, edited in Admin > Business > Services. */
export const QuestionOverride = z.object({
  service: z.string().min(1).max(40),
  questionId: z.string().min(1).max(40),
  hidden: z.boolean().default(false),
  required: z.boolean().nullable().default(null),
  sort: z.number().int().nullable().default(null),
});
export type QuestionOverride = z.infer<typeof QuestionOverride>;

/** The questions to show for a service after a market's overrides (common ones first). */
export function questionsFor(service: string, overrides: QuestionOverride[] = []): Question[] {
  const base = [...COMMON_QUESTIONS, ...(SERVICE_QUESTIONS[service] ?? [])];
  const mine = overrides.filter((o) => o.service === service || o.service === "*");
  const ov = (id: string) =>
    mine.find((o) => o.questionId === id && o.service === service) ??
    mine.find((o) => o.questionId === id);
  return (
    base
      .map((q, i) => ({ q, i, o: ov(q.id) }))
      // "Are you in a safe place?" can never be hidden: it decides the 911 banner.
      .filter(({ q, o }) => !o?.hidden || q.id === "safety")
      .map(({ q, i, o }) => ({
        q:
          o?.required === null || o?.required === undefined || q.id === "safety"
            ? q
            : { ...q, required: o.required },
        i,
        sort: o?.sort ?? i,
      }))
      .sort((a, b) => a.sort - b.sort || a.i - b.i)
      .map(({ q }) => q)
  );
}

export type Answers = Record<string, string>;

const visible = (q: Question, a: Answers) => !q.showIf || a[q.showIf.id] === q.showIf.eq;

/**
 * Validates answers for a service: required questions must be answered, every value must be one
 * of the options (or a number in range, a date, short text). Hidden follow-ups are dropped.
 * Returns the clean answers or the ids of the questions to fix.
 */
export function validateAnswers(
  service: string,
  raw: Record<string, unknown>,
  overrides: QuestionOverride[] = [],
  now = Date.now(),
): { ok: true; answers: Answers } | { ok: false; missing: string[] } {
  const qs = questionsFor(service, overrides);
  const answers: Answers = {};
  for (const q of qs) {
    const v = raw[q.id];
    const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
    const value = s || q.default || "";
    if (value) answers[q.id] = value;
  }
  const missing: string[] = [];
  for (const q of qs) {
    if (!visible(q, answers)) {
      delete answers[q.id];
      continue;
    }
    const v = answers[q.id];
    if (v === undefined) {
      if (q.required) missing.push(q.id);
      continue;
    }
    const ok =
      q.kind === "chips"
        ? (q.options ?? []).includes(v)
        : q.kind === "count"
          ? /^\d+$/.test(v) && Number(v) >= (q.min ?? 0) && Number(v) <= (q.max ?? 99)
          : q.kind === "datetime"
            ? z.iso.datetime({ local: true }).safeParse(v).success &&
              Date.parse(v) > now - 3_600_000
            : v.length <= (q.max ?? 200);
    if (!ok) {
      delete answers[q.id];
      if (q.required) missing.push(q.id);
    }
  }
  return missing.length ? { ok: false, missing } : { ok: true, answers };
}

/** Everything the answers cause (the 911 banner, urgent, suggestions). */
export function effectsOf(service: string, a: Answers): Effect[] {
  const out = new Set<Effect>();
  for (const q of [...COMMON_QUESTIONS, ...(SERVICE_QUESTIONS[service] ?? [])]) {
    const v = a[q.id];
    if (v && visible(q, a)) for (const e of q.effects?.[v] ?? []) out.add(e);
  }
  return [...out];
}

/** Short tags for the provider offer and the admin panel, most important first. */
export function tagsOf(service: string, a: Answers): string[] {
  const order = [
    "childInside",
    "inLane",
    "accident",
    "flatbed",
    "noRoll",
    "noSpare",
    "twoFlats",
    "ev",
    "evCharge",
  ];
  const tags: string[] = [];
  for (const q of [...COMMON_QUESTIONS, ...(SERVICE_QUESTIONS[service] ?? [])]) {
    const v = a[q.id];
    const tag = v && visible(q, a) ? q.tags?.[v] : undefined;
    if (tag) tags.push(tag);
  }
  return tags.sort((x, y) => {
    const ix = order.indexOf(x);
    const iy = order.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
}

/** Stored with the request: answers plus the version they were asked with. */
export const StoredAnswers = z.object({
  version: z.number().int().min(1),
  service: z.string(),
  answers: z.record(z.string(), z.string()),
});
export type StoredAnswers = z.infer<typeof StoredAnswers>;
