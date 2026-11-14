import { z } from "zod";

/** Demo driver session (demo mode only; there are no driver account tables yet). HttpOnly cookie. */
export const DRIVER_COOKIE = "rsos_driver";

export const DriverSessionSchema = z.object({
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
