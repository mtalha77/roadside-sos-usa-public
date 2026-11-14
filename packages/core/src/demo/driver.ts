import { demoColors, demoMarkets, demoVehicles } from "@rsos/config/demo-fixtures";
import { DEMO_SERVICES, rng, seedFrom } from "./engine";

export type DemoDriverProfile = {
  vehicles: {
    id: string;
    make: string;
    model: string;
    type: string;
    color: string;
    year: number;
    isDefault: boolean;
  }[];
  places: { id: string; label: string; area: string; lat: number; lng: number }[];
  favorites: { slug: string; name: string; marketSlug: string }[];
  history: {
    token: string;
    serviceSlug: string;
    providerName: string;
    priceCents: number;
    daysAgo: number;
    marketSlug: string;
  }[];
};

/** A returning driver's saved data in demo mode, derived from their phone (fictional, stable). */
export function demoDriverProfile(phone: string, marketSlug = "houston"): DemoDriverProfile {
  const r = rng(seedFrom(phone));
  const m = demoMarkets[marketSlug] ?? Object.values(demoMarkets)[0]!;
  const vehicles = [0, 1].map((i) => {
    const v = demoVehicles[Math.floor(r() * demoVehicles.length)]!;
    return {
      id: `v${i}`,
      make: v.make,
      model: v.model,
      type: v.type,
      color: demoColors[Math.floor(r() * demoColors.length)]!,
      year: 2014 + Math.floor(r() * 11),
      isDefault: i === 0,
    };
  });
  const places = ["Home", "Work"].map((label, i) => {
    const a = m.areas[Math.floor(r() * m.areas.length)]!;
    return { id: `p${i}`, label, area: a.name, lat: a.lat, lng: a.lng };
  });
  const favorites = m.providers
    .slice(0, 2)
    .map((p) => ({ slug: p.slug, name: p.name, marketSlug }));
  const history = [3, 17, 46, 120].map((daysAgo) => {
    const p = m.providers[Math.floor(r() * m.providers.length)]!;
    return {
      token: `demo_${marketSlug}_${Math.floor(Date.UTC(2026, 10, 1) / 75_000 - daysAgo * 1152).toString(36)}`,
      serviceSlug: DEMO_SERVICES[Math.floor(r() * DEMO_SERVICES.length)]!,
      providerName: p.name,
      priceCents: Math.round((60 + r() * 90) / 5) * 500,
      daysAgo,
      marketSlug,
    };
  });
  return { vehicles, places, favorites, history };
}
