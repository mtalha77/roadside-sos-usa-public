import { z } from "zod";

/** Cookie holding the draft token (HttpOnly; the draft itself is in the database). */
export const DRAFT_COOKIE = "rsos_draft";

export const STEPS = [
  "location",
  "problem",
  "destination",
  "vehicle",
  "safety",
  "contact",
  "verify",
] as const;
export type Step = (typeof STEPS)[number];

/** Services that need a destination (tow, winch out). */
export const NEEDS_DESTINATION = new Set(["tow", "winch-out"]);

export const MILE_RANGES = { lt5: 4, "5to10": 8, "10to20": 15, "20to40": 30, gt40: 50 } as const;
export const VEHICLE_TYPES = ["car", "suv", "pickup", "van", "motorcycle", "rv"] as const;
export const VEHICLE_MAKES = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "Mitsubishi",
  "Nissan",
  "Ram",
  "Rivian",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
] as const;
export const COLORS = [
  "White",
  "Black",
  "Silver",
  "Gray",
  "Blue",
  "Red",
  "Green",
  "Other",
] as const;
export const FOLLOW_UPS: Record<string, { key: string; options: string[] }> = {
  "flat-tire": { key: "flatTire", options: ["yes", "no", "unsure"] },
  "locked-out": { key: "lockedOut", options: ["inside", "lost"] },
  "out-of-gas": { key: "outOfGas", options: ["regular", "diesel"] },
  "wont-start": { key: "wontStart", options: ["clicking", "nothing", "lights"] },
};

export const DraftSchema = z
  .object({
    market: z.string(),
    lat: z.number(),
    lng: z.number(),
    approx: z.boolean(),
    address: z.string(),
    note: z.string(),
    service: z.string(),
    followUp: z.string(),
    destAddress: z.string(),
    destMiles: z.enum(Object.keys(MILE_RANGES) as [keyof typeof MILE_RANGES]),
    vehicleType: z.enum(VEHICLE_TYPES),
    make: z.string(),
    model: z.string(),
    color: z.string(),
    year: z.number().nullable(),
    ev: z.boolean(),
    safe: z.boolean(),
    highway: z.boolean(),
    passengers: z.number(),
    name: z.string(),
    phone: z.string(),
    codeHash: z.string(),
    codeAttempts: z.number(),
    demoCode: z.string(),
    smsAvailable: z.boolean(),
    attribution: z.record(z.string(), z.string()),
    /** Quick repeat request from the driver account: safety becomes one tap. */
    quick: z.boolean(),
  })
  .partial();
export type Draft = z.infer<typeof DraftSchema>;

/** The steps this draft goes through (destination only for tow and winch out). */
export function stepsFor(d: Draft): Step[] {
  return STEPS.filter((s) => s !== "destination" || NEEDS_DESTINATION.has(d.service ?? ""));
}

/** First step the draft has not finished: the flow resumes there after a reload. */
export function currentStep(d: Draft): Step {
  if (d.lat === undefined || !d.market) return "location";
  if (!d.service) return "problem";
  if (NEEDS_DESTINATION.has(d.service) && !d.destAddress) return "destination";
  if (!d.vehicleType) return "vehicle";
  if (d.safe === undefined) return "safety";
  if (!d.phone || !d.name) return "contact";
  return "verify";
}

/** A step may be shown only when every earlier step is done. */
export function allowedStep(d: Draft, wanted: string | undefined): Step {
  const order = stepsFor(d);
  const now = currentStep(d);
  const w = order.find((s) => s === wanted);
  return w && order.indexOf(w) <= order.indexOf(now) ? w : now;
}

export function previousStep(d: Draft, step: Step): Step | null {
  const order = stepsFor(d);
  const i = order.indexOf(step);
  return i > 0 ? order[i - 1]! : null;
}

export const toE164 = (raw: unknown) => {
  const digits = String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
};

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
];
/** Ad and campaign parameters from the landing URL, kept with the draft. */
export function attributionFrom(
  params: URLSearchParams | Record<string, string | undefined>,
): Record<string, string> {
  const get = (k: string) =>
    (params instanceof URLSearchParams ? params.get(k) : params[k]) ?? undefined;
  const out: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}
