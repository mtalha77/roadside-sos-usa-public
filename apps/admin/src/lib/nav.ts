/** Admin sections (RSOS-071). Each ticket adds its route to BUILT when the screen exists. */
export const SECTIONS = [
  { href: "/dispatch", key: "dispatch", shortcut: "g d" },
  { href: "/requests", key: "requests", shortcut: "g r" },
  { href: "/intake", key: "intake", shortcut: "g i" },
  { href: "/providers", key: "providers", shortcut: "g p" },
  { href: "/recruitment", key: "recruitment", shortcut: "g e" },
  { href: "/markets", key: "markets", shortcut: "g m" },
  { href: "/pricing", key: "pricing", shortcut: "g $" },
  { href: "/finance", key: "finance", shortcut: "g f" },
  { href: "/reviews", key: "reviews", shortcut: "g v" },
  { href: "/analytics", key: "analytics", shortcut: "g a" },
  { href: "/content", key: "content", shortcut: "g c" },
  { href: "/settings", key: "settings", shortcut: "g s" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

export const BUILT: ReadonlySet<string> = new Set([
  "/",
  "/dispatch",
  "/requests",
  "/intake",
  "/providers",
  "/recruitment",
  "/markets",
  "/pricing",
  "/finance",
]);
export const builtSections = () => SECTIONS.filter((s) => BUILT.has(s.href));
