import { z } from "zod";

/**
 * A market is a metro area (e.g. a city and its suburbs). Every request, provider, price,
 * fee, phone number and page belongs to exactly one market. Markets live in the database;
 * launching a city is an admin action, never a code change. Never hardcode a market here.
 */
export const MarketSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

export const UsStateCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Use a two-letter uppercase state code");

export const MarketSchema = z.object({
  id: z.uuid(),
  slug: MarketSlugSchema,
  name: z.string().trim().min(2).max(120),
  stateCode: UsStateCodeSchema,
  /** IANA time zone, e.g. "America/Chicago". */
  timeZone: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
  currency: z.literal("USD"),
  isActive: z.boolean(),
});

export type Market = z.infer<typeof MarketSchema>;

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
