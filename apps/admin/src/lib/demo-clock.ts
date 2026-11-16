import "server-only";
import { isDemoMode } from "@rsos/config/demo";
import { cookies } from "next/headers";
import { z } from "zod";

const Clock = z.object({ offset: z.number().int(), paused: z.number().int().nullable() });
export type DemoClock = z.infer<typeof Clock>;
export const DEMO_CLOCK_COOKIE = "rsos_demo_clock";

/** The demo scenario clock for admin screens: real time unless Demo controls paused or moved it. */
export async function demoNow(): Promise<number> {
  const real = Date.now();
  if (!isDemoMode()) return real;
  const raw = (await cookies()).get(DEMO_CLOCK_COOKIE)?.value;
  const parsed = raw ? Clock.safeParse(JSON.parse(decodeURIComponent(raw))) : null;
  if (!parsed?.success) return real;
  return parsed.data.paused ?? real + parsed.data.offset;
}

export async function readDemoClock(): Promise<DemoClock> {
  const raw = (await cookies()).get(DEMO_CLOCK_COOKIE)?.value;
  try {
    return Clock.parse(JSON.parse(decodeURIComponent(raw ?? "")));
  } catch {
    return { offset: 0, paused: null };
  }
}
