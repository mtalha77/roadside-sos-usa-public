import { canSee } from "@rsos/config/permissions";

/** Admin sections (RSOS-071). Each ticket adds its route to BUILT when the screen exists. */
export const SECTIONS = [
  { href: "/inbox", key: "inbox", shortcut: "g n" },
  { href: "/dispatch", key: "dispatch", shortcut: "g d" },
  { href: "/requests", key: "requests", shortcut: "g r" },
  { href: "/intake", key: "intake", shortcut: "g i" },
  { href: "/providers", key: "providers", shortcut: "g p" },
  { href: "/recruitment", key: "recruitment", shortcut: "g e" },
  { href: "/markets", key: "markets", shortcut: "g m" },
  { href: "/pricing", key: "pricing", shortcut: "g $" },
  { href: "/economics", key: "economics", shortcut: "g o" },
  { href: "/finance", key: "finance", shortcut: "g f" },
  { href: "/reviews", key: "reviews", shortcut: "g v" },
  { href: "/analytics", key: "analytics", shortcut: "g a" },
  { href: "/marketing", key: "marketing", shortcut: "g k" },
  { href: "/campaign", key: "campaign", shortcut: "g t" },
  { href: "/content", key: "content", shortcut: "g c" },
  { href: "/team", key: "team", shortcut: "g u" },
  { href: "/settings", key: "settings", shortcut: "g s" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

export const BUILT: ReadonlySet<string> = new Set([
  "/",
  "/inbox",
  "/dispatch",
  "/requests",
  "/intake",
  "/providers",
  "/recruitment",
  "/markets",
  "/pricing",
  "/economics",
  "/finance",
  "/reviews",
  "/analytics",
  "/marketing",
  "/campaign",
  "/content",
  "/team",
  "/settings",
  "/walkthrough",
]);
export const builtSections = () => SECTIONS.filter((s) => BUILT.has(s.href));

/** The sections this role may open (RSOS-102): the menu, palette and shortcuts show only these. */
export const sectionsFor = (role: string) => builtSections().filter((s) => canSee(role, s.key));
