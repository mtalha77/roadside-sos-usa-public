import { z } from "zod";

/** Demo driver session (demo mode only; there are no driver account tables yet). HttpOnly cookie. */
export const DRIVER_COOKIE = "rsos_driver";

export const DriverSessionSchema = z.object({
  /** Signs in with an emailed code (no SMS); the phone is a fictional 555-01xx number from it. */
  email: z.string().default(""),
  phone: z.string(),
  pendingCodeHash: z.string().optional(),
  signedIn: z.boolean(),
  removedVehicles: z.array(z.string()).default([]),
  removedPlaces: z.array(z.string()).default([]),
  removedFavorites: z.array(z.string()).default([]),
  defaultVehicle: z.string().optional(),
});
export type DriverSession = z.infer<typeof DriverSessionSchema>;

export function readDriverSession(raw: string | undefined): DriverSession | null {
  if (!raw) return null;
  try {
    return DriverSessionSchema.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

/** A fictional 555-01xx number derived from the demo email (for the quick request's draft). */
export function demoPhoneFor(email: string): string {
  let h = 0;
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `+1713555${String(100 + (h % 100)).padStart(4, "0")}`;
}
