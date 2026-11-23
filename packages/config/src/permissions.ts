/**
 * Roles and what each can see (RSOS-102). One source for the admin menu, command palette,
 * shortcuts and route guard; the database enforces the same rules with RLS (policies use
 * `jwt_staff_role()`), and tests per role prove both.
 *
 * Database role names are kept (renaming an enum is risky); the labels change:
 * super_admin = Owner, ops_manager = Operations manager, dispatcher = Dispatcher,
 * support = Provider success, finance = Finance, marketing = Marketing, read_only = Viewer.
 * Provider side: owner = Provider owner, manager = Dispatcher, operator = Technician.
 */

export const STAFF_ROLES = [
  "super_admin",
  "ops_manager",
  "dispatcher",
  "support",
  "finance",
  "marketing",
  "read_only",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PROVIDER_ROLES = ["owner", "manager", "operator"] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

const ALL: readonly StaffRole[] = STAFF_ROLES;
const OPS: readonly StaffRole[] = ["super_admin", "ops_manager"];
const LIVE: readonly StaffRole[] = [...OPS, "dispatcher"];

/** Admin sections and the roles that may open them (view). Edits are checked per action. */
export const SECTION_ROLES = {
  today: ALL,
  inbox: LIVE,
  dispatch: LIVE,
  requests: [...LIVE, "support", "finance", "read_only"],
  calls: LIVE,
  intake: LIVE,
  providers: [...LIVE, "support", "read_only"],
  recruitment: [...OPS, "support"],
  reviews: [...OPS, "support"],
  markets: [...OPS, "support", "read_only"],
  pricing: OPS,
  economics: OPS,
  finance: [...OPS, "finance", "read_only"],
  credits: [...OPS, "finance"],
  services: [...OPS, "support"],
  marketing: [...OPS, "marketing", "read_only"],
  campaign: [...OPS, "marketing", "read_only"],
  analytics: [...OPS, "marketing", "finance", "read_only"],
  content: [...OPS, "marketing"],
  team: OPS,
  settings: OPS,
  walkthrough: LIVE,
  account: ALL,
} as const satisfies Record<string, readonly StaffRole[]>;
export type SectionKey = keyof typeof SECTION_ROLES;

/** First path segment of each admin route, mapped to its section. */
const PATH_SECTION: Record<string, SectionKey> = {
  "": "today",
  inbox: "inbox",
  dispatch: "dispatch",
  requests: "requests",
  calls: "calls",
  intake: "intake",
  providers: "providers",
  recruitment: "recruitment",
  reviews: "reviews",
  markets: "markets",
  pricing: "pricing",
  economics: "economics",
  finance: "finance",
  credits: "credits",
  services: "services",
  marketing: "marketing",
  campaign: "campaign",
  analytics: "analytics",
  content: "content",
  team: "team",
  staff: "team",
  settings: "settings",
  walkthrough: "walkthrough",
  account: "account",
};

/** API routes that belong to a section (the rest check permissions themselves). */
const API_SECTION: Record<string, SectionKey> = {
  board: "dispatch",
  calls: "calls",
  campaign: "campaign",
  marketing: "marketing",
  finance: "finance",
};

const isStaffRole = (r: unknown): r is StaffRole =>
  typeof r === "string" && (STAFF_ROLES as readonly string[]).includes(r);

export function canSee(role: string | null | undefined, section: SectionKey): boolean {
  return isStaffRole(role) && (SECTION_ROLES[section] as readonly string[]).includes(role);
}

/** The section a path belongs to, or null when the path is not a section (left to the page). */
export function sectionForPath(path: string): SectionKey | null {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "api") return parts[1] ? (API_SECTION[parts[1]] ?? null) : null;
  return PATH_SECTION[parts[0] ?? ""] ?? null;
}

/** Route guard: may this role open this path? Paths outside the sections are allowed here. */
export function canOpenPath(role: string | null | undefined, path: string): boolean {
  const section = sectionForPath(path);
  return section === null || canSee(role, section);
}

/** Marketing and viewers never see customer phone numbers or emails (masked in every screen). */
export function masksCustomerData(role: string | null | undefined): boolean {
  return role === "marketing" || role === "read_only";
}

/** "+12105550123" as "(210) •••-••23" for roles that must not see customer contact details. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) •••-••${d.slice(8)}` : "•••";
}

/** Only owners change owners; operations managers manage every other role. */
export function canManageRole(actor: string | null | undefined, target: StaffRole): boolean {
  if (actor === "super_admin") return true;
  return actor === "ops_manager" && target !== "super_admin";
}

// ---------------------------------------------------------------------------------------------
// Provider portal (RSOS-104): owner, dispatcher (enum "manager") and technician (enum "operator").
// ---------------------------------------------------------------------------------------------
const P_ALL: readonly ProviderRole[] = PROVIDER_ROLES;
const P_OFFICE: readonly ProviderRole[] = ["owner", "manager"];

/** Provider portal sections and the roles that may open them. Technicians see only their jobs. */
export const PROVIDER_SECTION_ROLES = {
  home: P_OFFICE,
  offer: P_OFFICE,
  jobs: P_ALL,
  wallet: P_OFFICE,
  profile: P_OFFICE,
  services: P_OFFICE,
  team: ["owner"],
  insights: P_OFFICE,
  notifications: P_OFFICE,
  onboarding: ["owner"],
  more: P_OFFICE,
  help: P_ALL,
  account: P_ALL,
  install: P_ALL,
} as const satisfies Record<string, readonly ProviderRole[]>;
export type ProviderSection = keyof typeof PROVIDER_SECTION_ROLES;

const isProviderRole = (r: unknown): r is ProviderRole =>
  typeof r === "string" && (PROVIDER_ROLES as readonly string[]).includes(r);

export function providerCanSee(role: string | null | undefined, section: ProviderSection): boolean {
  return (
    isProviderRole(role) && (PROVIDER_SECTION_ROLES[section] as readonly string[]).includes(role)
  );
}

/** The portal section a page belongs to, or null (sign-in, APIs and other pages decide alone). */
export function providerSectionForPath(path: string): ProviderSection | null {
  const first = path.split("/").filter(Boolean)[0] ?? "home";
  return first in PROVIDER_SECTION_ROLES ? (first as ProviderSection) : null;
}

/** Where a role lands when it opens the portal: technicians go straight to their jobs. */
export const providerHome = (role: string | null | undefined) =>
  role === "operator" ? "/jobs" : "/";
