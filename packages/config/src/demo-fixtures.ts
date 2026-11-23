/**
 * Fixtures for demo mode, per market slug. Areas and highways are real; every company and person
 * is fictional. Phone numbers use the 555-01xx range reserved for fiction. Lives in packages/config
 * because it names cities (rule 2 in CLAUDE.md).
 */
export type DemoMarketFixture = {
  areas: { name: string; lat: number; lng: number }[];
  highways: string[];
  providers: {
    name: string;
    slug: string;
    area: string;
    trucks: number;
    rating: number | null;
    reviews: number;
    /** Original monogram logo: initials, emblem shape and one of the muted `mark-*` colours. */
    logo: { monogram: string; shape: "circle" | "shield" | "hex" | "square"; tone: number };
    years: number;
    payments: ("card" | "cash" | "apple_pay" | "google_pay" | "zelle")[];
  }[];
  areaCode: string;
};

export const demoMarkets: Record<string, DemoMarketFixture> = {
  "san-antonio": {
    areaCode: "210",
    highways: ["I-35", "I-10", "Loop 410", "Loop 1604", "US 281", "I-37"],
    areas: [
      { name: "Downtown", lat: 29.4241, lng: -98.4936 },
      { name: "Stone Oak", lat: 29.6436, lng: -98.4801 },
      { name: "Medical Center", lat: 29.5079, lng: -98.5767 },
      { name: "Alamo Heights", lat: 29.4846, lng: -98.4653 },
      { name: "Leon Valley", lat: 29.4952, lng: -98.6186 },
      { name: "Converse", lat: 29.518, lng: -98.3161 },
      { name: "Schertz", lat: 29.5522, lng: -98.2697 },
      { name: "New Braunfels", lat: 29.703, lng: -98.1245 },
    ],
    providers: [
      {
        name: "Mesquite Lantern Roadside (demo)",
        slug: "mesquite-lantern",
        logo: { monogram: "ML", shape: "circle", tone: 1 },
        years: 12,
        payments: ["card", "cash", "apple_pay"],
        area: "Stone Oak",
        trucks: 4,
        rating: 4.8,
        reviews: 212,
      },
      {
        name: "Riverwalk Relay Towing (demo)",
        slug: "riverwalk-relay",
        logo: { monogram: "RR", shape: "shield", tone: 3 },
        years: 19,
        payments: ["card", "cash", "google_pay", "zelle"],
        area: "Downtown",
        trucks: 6,
        rating: 4.6,
        reviews: 341,
      },
      {
        name: "Bluebonnet Bend Recovery (demo)",
        slug: "bluebonnet-bend",
        logo: { monogram: "BB", shape: "hex", tone: 2 },
        years: 6,
        payments: ["card", "cash"],
        area: "Schertz",
        trucks: 2,
        rating: 4.9,
        reviews: 87,
      },
      {
        name: "Comal Kettle Road Service (demo)",
        slug: "comal-kettle",
        logo: { monogram: "CK", shape: "square", tone: 5 },
        years: 2,
        payments: ["card", "zelle"],
        area: "Leon Valley",
        trucks: 3,
        rating: null,
        reviews: 0,
      },
    ],
  },
  "las-vegas": {
    areaCode: "702",
    highways: ["I-15", "I-11", "US 95", "I-215", "CC-215"],
    areas: [
      { name: "The Strip", lat: 36.1147, lng: -115.1728 },
      { name: "Downtown", lat: 36.1699, lng: -115.1398 },
      { name: "Henderson", lat: 36.0395, lng: -114.9817 },
      { name: "North Las Vegas", lat: 36.1989, lng: -115.1175 },
      { name: "Summerlin", lat: 36.1885, lng: -115.3069 },
      { name: "Spring Valley", lat: 36.1081, lng: -115.245 },
      { name: "Enterprise", lat: 36.0253, lng: -115.2419 },
    ],
    providers: [
      {
        name: "Sagebrush Comet Towing (demo)",
        slug: "sagebrush-comet",
        logo: { monogram: "SC", shape: "circle", tone: 6 },
        years: 9,
        payments: ["card", "cash", "apple_pay"],
        area: "Henderson",
        trucks: 5,
        rating: 4.7,
        reviews: 198,
      },
      {
        name: "Mojave Juniper Roadside (demo)",
        slug: "mojave-juniper",
        logo: { monogram: "MJ", shape: "hex", tone: 7 },
        years: 15,
        payments: ["card", "cash", "google_pay"],
        area: "The Strip",
        trucks: 3,
        rating: 4.5,
        reviews: 260,
      },
      {
        name: "Kestrel Wash Recovery (demo)",
        slug: "kestrel-wash",
        logo: { monogram: "KW", shape: "shield", tone: 4 },
        years: 7,
        payments: ["card", "zelle"],
        area: "Summerlin",
        trucks: 2,
        rating: 4.9,
        reviews: 64,
      },
      {
        name: "Neon Sparrow Road Service (demo)",
        slug: "neon-sparrow",
        logo: { monogram: "NS", shape: "square", tone: 8 },
        years: 3,
        payments: ["card", "cash"],
        area: "North Las Vegas",
        trucks: 4,
        rating: null,
        reviews: 0,
      },
    ],
  },
  houston: {
    areaCode: "713",
    highways: ["I-45", "I-10", "I-69", "I-610", "Beltway 8", "SH 99", "US 290"],
    areas: [
      { name: "Downtown", lat: 29.7604, lng: -95.3698 },
      { name: "The Heights", lat: 29.7989, lng: -95.3985 },
      { name: "Galleria", lat: 29.7392, lng: -95.4637 },
      { name: "Katy", lat: 29.7858, lng: -95.8245 },
      { name: "Sugar Land", lat: 29.6197, lng: -95.6349 },
      { name: "The Woodlands", lat: 30.1658, lng: -95.4613 },
      { name: "Pasadena", lat: 29.6911, lng: -95.2091 },
      { name: "Cypress", lat: 29.9691, lng: -95.6972 },
    ],
    providers: [
      {
        name: "Magnolia Heron Roadside (demo)",
        slug: "magnolia-heron",
        logo: { monogram: "MH", shape: "shield", tone: 2 },
        years: 21,
        payments: ["card", "cash", "apple_pay", "zelle"],
        area: "The Heights",
        trucks: 7,
        rating: 4.7,
        reviews: 402,
      },
      {
        name: "Ship Channel Compass Towing (demo)",
        slug: "ship-channel-compass",
        logo: { monogram: "SC", shape: "hex", tone: 3 },
        years: 11,
        payments: ["card", "cash"],
        area: "Pasadena",
        trucks: 5,
        rating: 4.6,
        reviews: 288,
      },
      {
        name: "Brays Bayou Anchor Recovery (demo)",
        slug: "brays-bayou-anchor",
        logo: { monogram: "BA", shape: "circle", tone: 5 },
        years: 5,
        payments: ["card", "google_pay"],
        area: "Katy",
        trucks: 3,
        rating: 4.8,
        reviews: 131,
      },
      {
        name: "Cypress Creek Owl Road Service (demo)",
        slug: "cypress-creek-owl",
        logo: { monogram: "CO", shape: "square", tone: 1 },
        years: 4,
        payments: ["card", "cash", "zelle"],
        area: "The Woodlands",
        trucks: 2,
        rating: null,
        reviews: 0,
      },
    ],
  },
};

/** Masked number shown for calls and texts between a provider and a driver in demo mode. */
export const demoMaskedNumber = "+15555550100";

export const demoPeople = {
  first: [
    "Maria",
    "James",
    "Ana",
    "Luis",
    "Tasha",
    "Kevin",
    "Priya",
    "Marcus",
    "Elena",
    "Derek",
    "Sofia",
    "Jamal",
    "Rosa",
    "Tyler",
    "Grace",
    "Omar",
  ],
  lastInitial: ["G", "T", "R", "M", "W", "L", "S", "B", "H", "C", "P", "D"],
};

export const demoVehicles = [
  { make: "Toyota", model: "Camry", type: "car" },
  { make: "Honda", model: "Civic", type: "car" },
  { make: "Ford", model: "F-150", type: "pickup" },
  { make: "Chevrolet", model: "Silverado", type: "pickup" },
  { make: "Nissan", model: "Rogue", type: "suv" },
  { make: "Tesla", model: "Model 3", type: "car", ev: true },
  { make: "Jeep", model: "Grand Cherokee", type: "suv" },
  { make: "Honda", model: "Odyssey", type: "van" },
  { make: "Hyundai", model: "Elantra", type: "car" },
  { make: "Ram", model: "1500", type: "pickup" },
] as const;

export const demoColors = ["White", "Black", "Silver", "Gray", "Blue", "Red"] as const;

/** Provider plans shown in the wallet (RSOS-057). Prices are placeholders until pricing is decided. */
export const demoPlans = [
  { id: "basic", monthlyCents: 0, feeDiscountPct: 0, featured: false, priority: false },
  { id: "pro", monthlyCents: 4900, feeDiscountPct: 20, featured: false, priority: true },
  { id: "featured", monthlyCents: 9900, feeDiscountPct: 20, featured: true, priority: true },
] as const;

/** Top-up presets in cents (RSOS-057). */
export const topUpPresets = [10000, 25000, 50000] as const;

/** Live providers wanted per market before launch (RSOS-076 coverage target; a placeholder). */
export const coverageTarget = 12;

/** Names the demo companies had before batch 3 polish; demo sign-in renames them in place. */
export const legacyDemoProviderNames: readonly string[] = [
  "Lone Mesa Roadside (demo)",
  "Riverbend Tow & Assist (demo)",
  "Bluebonnet Recovery (demo)",
  "Cactus Line Service (demo)",
  "Desert Star Towing (demo)",
  "Neon Mile Roadside (demo)",
  "Red Rock Assist (demo)",
  "Sandline Recovery (demo)",
  "Bayou City Roadside (demo)",
  "Gulf Breeze Towing (demo)",
  "Westpark Assist (demo)",
  "Pinewood Recovery (demo)",
];
