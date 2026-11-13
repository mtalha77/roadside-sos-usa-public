import type { Market } from "@rsos/core";

/**
 * Test data factories. Deterministic (a counter, no randomness) so failures reproduce.
 * Values are clearly fake: reserved 555-01xx phone numbers, ".test" domains, "Test" names.
 * Shapes follow the schema; tables arrive in RSOS-016 and the factories track them.
 */
let seq = 0;
const next = () => ++seq;

/** Reset between tests if you need stable IDs. */
export function resetFactories() {
  seq = 0;
}

function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

export function buildMarket(overrides: Partial<Market> = {}): Market {
  const n = next();
  return {
    id: uuid(n),
    slug: `test-metro-${n}`,
    name: `Test Metro ${n}`,
    stateCode: "TX",
    timeZone: "America/Chicago",
    currency: "USD",
    isActive: true,
    ...overrides,
  };
}

export type ProviderFixture = {
  id: string;
  marketId: string;
  companyName: string;
  phone: string;
  rating: number | null;
  reviewCount: number;
  insured: boolean;
  licensed: boolean;
  status: "applied" | "active" | "paused" | "suspended";
};

export function buildProvider(overrides: Partial<ProviderFixture> = {}): ProviderFixture {
  const n = next();
  return {
    id: uuid(n),
    marketId: overrides.marketId ?? buildMarket().id,
    companyName: `Test Towing ${n}`,
    phone: `+1555555${String(100 + (n % 100)).padStart(4, "0")}`,
    rating: null,
    reviewCount: 0,
    insured: true,
    licensed: true,
    status: "active",
    ...overrides,
  };
}

export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "quoting",
  "quoted",
  "accepted",
  "en_route",
  "on_site",
  "completed",
  "cancelled",
  "expired",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestFixture = {
  id: string;
  shortCode: string;
  marketId: string;
  serviceSlug: string;
  status: RequestStatus;
  channel: "web" | "phone" | "landing_page";
  driverName: string;
  driverPhone: string;
  phoneVerified: boolean;
  pickup: { lat: number; lng: number; address: string };
  createdAt: string;
};

export function buildRequest(overrides: Partial<RequestFixture> = {}): RequestFixture {
  const n = next();
  return {
    id: uuid(n),
    shortCode: `R-${n.toString(36).toUpperCase().padStart(4, "0")}`,
    marketId: overrides.marketId ?? buildMarket().id,
    serviceSlug: "flat-tire",
    status: "submitted",
    channel: "web",
    driverName: `Test Driver ${n}`,
    driverPhone: "+15555550123",
    phoneVerified: false,
    pickup: { lat: 29.4, lng: -98.5, address: `${n} Test Street` },
    createdAt: new Date(Date.UTC(2026, 0, 1, 12, 0, n % 60)).toISOString(),
    ...overrides,
  };
}
