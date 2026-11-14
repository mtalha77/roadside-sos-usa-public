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
        name: "Lone Mesa Roadside (demo)",
        slug: "lone-mesa-roadside",
        area: "Stone Oak",
        trucks: 4,
        rating: 4.8,
        reviews: 212,
      },
      {
        name: "Riverbend Tow & Assist (demo)",
        slug: "riverbend-tow",
        area: "Downtown",
        trucks: 6,
        rating: 4.6,
        reviews: 341,
      },
      {
        name: "Bluebonnet Recovery (demo)",
        slug: "bluebonnet-recovery",
        area: "Schertz",
        trucks: 2,
        rating: 4.9,
        reviews: 87,
      },
      {
        name: "Cactus Line Service (demo)",
        slug: "cactus-line",
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
        name: "Desert Star Towing (demo)",
        slug: "desert-star-towing",
        area: "Henderson",
        trucks: 5,
        rating: 4.7,
        reviews: 198,
      },
      {
        name: "Neon Mile Roadside (demo)",
        slug: "neon-mile-roadside",
        area: "The Strip",
        trucks: 3,
        rating: 4.5,
        reviews: 260,
      },
      {
        name: "Red Rock Assist (demo)",
        slug: "red-rock-assist",
        area: "Summerlin",
        trucks: 2,
        rating: 4.9,
        reviews: 64,
      },
      {
        name: "Sandline Recovery (demo)",
        slug: "sandline-recovery",
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
        name: "Bayou City Roadside (demo)",
        slug: "bayou-city-roadside",
        area: "The Heights",
        trucks: 7,
        rating: 4.7,
        reviews: 402,
      },
      {
        name: "Gulf Breeze Towing (demo)",
        slug: "gulf-breeze-towing",
        area: "Pasadena",
        trucks: 5,
        rating: 4.6,
        reviews: 288,
      },
      {
        name: "Westpark Assist (demo)",
        slug: "westpark-assist",
        area: "Katy",
        trucks: 3,
        rating: 4.8,
        reviews: 131,
      },
      {
        name: "Pinewood Recovery (demo)",
        slug: "pinewood-recovery",
        area: "The Woodlands",
        trucks: 2,
        rating: null,
        reviews: 0,
      },
    ],
  },
};

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
