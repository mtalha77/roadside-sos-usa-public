import { demoPeople } from "@rsos/config/demo-fixtures";
import {
  DEFAULT_DEMO_RANGES,
  DEMO_SERVICES,
  type DemoProvider,
  type PriceRanges,
  rng,
  seedFrom,
} from "./engine";

export type DemoJobPhoto = "tow" | "tire" | "jump" | "lockout";

export type DemoProviderProfile = {
  services: { slug: (typeof DEMO_SERVICES)[number]; fromCents: number }[];
  /** Count of reviews per star, 5 down to 1 (sums to the provider's review count). */
  breakdown: [number, number, number, number, number];
  /** A few recent reviews: stars, which sample text to show, who and how long ago. */
  reviews: { stars: number; text: number; author: string; daysAgo: number }[];
  /** Typical time from a request to this provider's quote, in seconds. */
  responseSec: number;
  /** Share of jobs where the provider arrived within the quoted time (0 to 1). */
  etaAccuracy: number;
  photos: DemoJobPhoto[];
  radiusMiles: number;
};

/** Number of sample review texts available in the messages (track.profile.reviewSamples). */
export const REVIEW_SAMPLE_COUNT = 8;

const round5 = (cents: number) => Math.round(cents / 500) * 500;

/**
 * A demo provider's full profile, derived from its slug so every app shows the same one. Prices
 * stay inside the market's ranges when given. Fictional, and only ever shown in demo mode.
 */
export function demoProviderProfile(
  provider: DemoProvider,
  ranges: PriceRanges = DEFAULT_DEMO_RANGES,
): DemoProviderProfile {
  const r = rng(seedFrom(`profile:${provider.slug}`));
  const services = DEMO_SERVICES.map((slug) => {
    const range = ranges[slug] ?? DEFAULT_DEMO_RANGES[slug]!;
    return { slug, fromCents: round5(range.min + r() * 0.35 * (range.max - range.min)) };
  });
  const total = provider.reviews;
  const rating = provider.rating ?? 0;
  // Spread the reviews so the average matches the provider's rating.
  const five = Math.round(total * Math.max(0, Math.min(1, (rating - 3.6) / 1.4)));
  const four = Math.round((total - five) * 0.7);
  const three = Math.round((total - five - four) * 0.6);
  const two = Math.round((total - five - four - three) * 0.6);
  const one = Math.max(0, total - five - four - three - two);
  const reviews = total
    ? Array.from({ length: Math.min(4, total) }, (_, i) => ({
        stars: i === 3 && rating < 4.7 ? 4 : 5,
        text: Math.floor(r() * REVIEW_SAMPLE_COUNT),
        author: `${demoPeople.first[Math.floor(r() * demoPeople.first.length)]} ${
          demoPeople.lastInitial[Math.floor(r() * demoPeople.lastInitial.length)]
        }.`,
        daysAgo: 2 + i * 6 + Math.floor(r() * 5),
      }))
    : [];
  const photos: DemoJobPhoto[] = (["tow", "tire", "jump", "lockout"] as const)
    .slice()
    .sort(() => r() - 0.5)
    .slice(0, 3);
  return {
    services,
    breakdown: [five, four, three, two, one],
    reviews,
    responseSec: 25 + Math.round(r() * 60),
    etaAccuracy: Math.round((0.86 + r() * 0.12) * 100) / 100,
    photos,
    radiusMiles: 10 + 5 * Math.floor(r() * 4),
  };
}
