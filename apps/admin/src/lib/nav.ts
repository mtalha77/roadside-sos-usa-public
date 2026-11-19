import { canSee, type SectionKey } from "@rsos/config/permissions";

export const NAV_GROUPS = ["operate", "network", "business", "system"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/**
 * Admin navigation (RSOS-071, regrouped in RSOS-103). `key` names the label
 * (`admin.sections.<key>`); `section` is the permission that decides who sees it (RSOS-102).
 * Phone intake is no longer a menu item: it opens from Inbox and Calls ("Log a call").
 */
export const SECTIONS = [
  { href: "/", key: "today", section: "today", group: "operate", shortcut: "g h" },
  { href: "/inbox", key: "inbox", section: "inbox", group: "operate", shortcut: "g n" },
  { href: "/dispatch", key: "dispatch", section: "dispatch", group: "operate", shortcut: "g d" },
  { href: "/requests", key: "requests", section: "requests", group: "operate", shortcut: "g r" },
  { href: "/calls", key: "calls", section: "calls", group: "operate", shortcut: "g l" },
  {
    href: "/providers",
    key: "providers",
    section: "providers",
    group: "network",
    shortcut: "g p",
  },
  {
    href: "/recruitment",
    key: "recruitment",
    section: "recruitment",
    group: "network",
    shortcut: "g e",
  },
  { href: "/reviews", key: "reviews", section: "reviews", group: "network", shortcut: "g v" },
  { href: "/markets", key: "markets", section: "markets", group: "business", shortcut: "g m" },
  { href: "/pricing", key: "pricing", section: "pricing", group: "business", shortcut: "g $" },
  {
    href: "/economics",
    key: "economics",
    section: "economics",
    group: "business",
    shortcut: "g o",
  },
  { href: "/finance", key: "finance", section: "finance", group: "business", shortcut: "g f" },
  { href: "/credits", key: "credits", section: "credits", group: "business", shortcut: "g w" },
  {
    href: "/marketing",
    key: "marketing",
    section: "marketing",
    group: "business",
    shortcut: "g k",
  },
  { href: "/campaign", key: "campaign", section: "campaign", group: "business", shortcut: "g t" },
  {
    href: "/analytics",
    key: "analytics",
    section: "analytics",
    group: "business",
    shortcut: "g a",
  },
  { href: "/content", key: "content", section: "content", group: "system", shortcut: "g c" },
  { href: "/team", key: "team", section: "team", group: "system", shortcut: "g u" },
  { href: "/settings", key: "settings", section: "settings", group: "system", shortcut: "g s" },
  {
    href: "/settings?tab=system",
    key: "status",
    section: "settings",
    group: "system",
    shortcut: "g y",
  },
] as const satisfies readonly {
  href: string;
  key: string;
  section: SectionKey;
  group: NavGroup;
  shortcut: string;
}[];
export type NavKey = (typeof SECTIONS)[number]["key"];

/** The menu items this role may open (RSOS-102): the menu, palette and shortcuts show only these. */
export const sectionsFor = (role: string) => SECTIONS.filter((s) => canSee(role, s.section));
