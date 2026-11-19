"use client";

import type { CommandAction } from "@rsos/ui/command-palette";
import { Dialog, DialogContent } from "@rsos/ui/dialog";
import { SidePanel, SidePanelContent } from "@rsos/ui/side-panel";
import { ThemeToggle } from "@rsos/ui/theme-toggle";
import {
  Activity,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  FileText,
  Gauge,
  Inbox,
  Menu,
  MessagesSquare,
  Map as MapIcon,
  Megaphone,
  Target,
  PhoneCall,
  Radio,
  Search,
  Settings,
  Star,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MarketSwitcher } from "./market-switcher";

const ICONS = {
  today: Gauge,
  inbox: MessagesSquare,
  dispatch: Radio,
  requests: Inbox,
  calls: PhoneCall,
  providers: Truck,
  recruitment: UserPlus,
  markets: MapIcon,
  pricing: DollarSign,
  economics: Calculator,
  finance: Wallet,
  reviews: Star,
  analytics: BarChart3,
  marketing: Megaphone,
  campaign: Target,
  content: FileText,
  team: Users,
  settings: Settings,
  status: Activity,
} as const;

// The palette (cmdk) loads on first open, not with every page (RSOS-103 speed).
const CommandPalette = dynamic(() =>
  import("@rsos/ui/command-palette").then((m) => m.CommandPalette),
);

const PALETTE_KEYS = "⌘K";
const HELP_KEY = "?";

type Section = {
  href: string;
  key: keyof typeof ICONS;
  group: string;
  label: string;
  shortcut: string;
};
const FOLDED = "rsos_nav_folded";
const subscribeFolded = (cb: () => void) => {
  window.addEventListener(FOLDED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(FOLDED, cb);
    window.removeEventListener("storage", cb);
  };
};
const readFolded = () => {
  try {
    return localStorage.getItem(FOLDED) ?? "[]";
  } catch {
    return "[]";
  }
};

/**
 * Admin shell (RSOS-071, regrouped in RSOS-103): sidebar grouped into Operate, Network, Business
 * and System (each group folds; the choice is remembered), only the sections the role may open,
 * market switcher, Cmd+K command palette (pages, find a request by code or phone, a provider by
 * name), "g then letter" shortcuts and a "?" cheat sheet. Light and dark.
 */
export function AdminShell({
  sections,
  groups,
  markets,
  selected,
  labels,
  footer,
  identity,
  children,
}: {
  /** "Dispatcher · San Antonio, Houston": the role and market scope (RSOS-102). */
  identity: string;
  sections: Section[];
  /** Group key to its translated heading, in menu order. */
  groups: Record<string, string>;
  markets: { slug: string; name: string }[];
  selected: string[];
  labels: Record<string, string>;
  footer: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const foldedRaw = useSyncExternalStore(subscribeFolded, readFolded, () => "[]");
  const folded = useMemo(() => {
    try {
      const v = JSON.parse(foldedRaw) as unknown;
      return Array.isArray(v) ? v.filter((g): g is string => typeof g === "string") : [];
    } catch {
      return [];
    }
  }, [foldedRaw]);
  const fold = (g: string) => {
    const next = folded.includes(g) ? folded.filter((x) => x !== g) : [...folded, g];
    try {
      localStorage.setItem(FOLDED, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(FOLDED));
  };
  const current = (href: string) => {
    const base = href.split("?")[0]!;
    if (href.includes("?")) return false;
    return base === "/" ? path === "/" : path === base || path.startsWith(`${base}/`);
  };
  useEffect(() => {
    let lead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (lead) {
        lead = false;
        const s = sections.find((x) => x.shortcut === `g ${e.key}`);
        if (s) {
          e.preventDefault();
          router.push(s.href);
        }
        return;
      }
      if (e.key === "g") {
        lead = true;
        clearTimeout(timer);
        timer = setTimeout(() => (lead = false), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, router]);
  // Cmd+K (Ctrl+K) opens the palette before its code has loaded; once open, it handles the keys.
  useEffect(() => {
    if (palette) return;
    const onK = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, [palette]);
  const q = query.trim();
  const actions: CommandAction[] = [
    ...sections.map((s) => ({
      id: s.href,
      label: s.label,
      group: labels.pages!,
      shortcut: s.shortcut,
      onSelect: () => router.push(s.href),
    })),
    {
      id: "/account",
      label: labels.account!,
      group: labels.pages!,
      onSelect: () => router.push("/account"),
    },
    ...(q
      ? [
          {
            id: `find-request-${q}`,
            label: `${labels.findRequest} “${q}”`,
            group: labels.find!,
            keywords: [q],
            onSelect: () => router.push(`/requests?q=${encodeURIComponent(q)}`),
          },
          {
            id: `find-provider-${q}`,
            label: `${labels.findProvider} “${q}”`,
            group: labels.find!,
            keywords: [q],
            onSelect: () => router.push(`/providers?q=${encodeURIComponent(q)}`),
          },
        ]
      : []),
    {
      id: "theme",
      label: labels.toggleTheme!,
      group: labels.actions!,
      onSelect: () =>
        document.querySelector<HTMLButtonElement>("[data-theme-toggle-wrap] button")?.click(),
    },
    {
      id: "shortcuts",
      label: labels.shortcuts!,
      group: labels.actions!,
      shortcut: "?",
      onSelect: () => setHelp(true),
    },
  ];
  const item =
    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground";
  const navGroups = (slim: boolean, where: "side" | "menu") => (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {Object.entries(groups).map(([g, heading]) => {
        const list = sections.filter((s) => s.group === g);
        if (!list.length) return null;
        const open = slim || !folded.includes(g);
        return (
          <div key={g} className="flex flex-col gap-1">
            {slim ? null : (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`nav-${where}-${g}`}
                onClick={() => fold(g)}
                className="flex min-h-10 items-center justify-between rounded-lg px-3 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
              >
                {heading}
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                />
              </button>
            )}
            <ul id={`nav-${where}-${g}`} hidden={!open} className="flex flex-col gap-1">
              {list.map((s) => {
                const Icon = ICONS[s.key];
                return (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className={item}
                      onClick={where === "menu" ? () => setMenu(false) : undefined}
                      aria-current={current(s.href) ? "page" : undefined}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      <span className={slim ? "sr-only" : undefined}>{s.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {labels.skip}
      </a>
      <nav
        aria-label={labels.nav}
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r bg-card p-3 md:flex ${collapsed ? "w-[4.5rem]" : "w-60"}`}
      >
        {navGroups(collapsed, "side")}
        <div className="flex flex-col gap-1 border-t pt-2">
          {footer}
          <button
            type="button"
            className={item}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <ChevronsRight aria-hidden="true" className="size-5 shrink-0" />
            ) : (
              <ChevronsLeft aria-hidden="true" className="size-5 shrink-0" />
            )}
            <span className={collapsed ? "sr-only" : undefined}>{labels.collapse}</span>
          </button>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <MarketSwitcher markets={markets} selected={selected} labels={labels} />
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground hover:bg-accent sm:max-w-sm"
          >
            <Search aria-hidden="true" className="size-4" />
            {labels.search}
            <kbd className="ml-auto rounded border px-1.5 text-xs">{PALETTE_KEYS}</kbd>
          </button>
          <Link
            href="/account"
            className="hidden min-h-12 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent lg:flex"
          >
            {identity}
          </Link>
          <span data-theme-toggle-wrap>
            <ThemeToggle label={labels.toggleTheme!} />
          </span>
          <button
            type="button"
            onClick={() => setMenu(true)}
            className="order-first flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent md:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
            {labels.menu}
          </button>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <SidePanel open={menu} onOpenChange={setMenu}>
        <SidePanelContent title={labels.navMobile} closeLabel={labels.close!}>
          <nav aria-label={labels.navMobile} className="flex flex-col gap-1">
            {navGroups(false, "menu")}
            <div className="mt-2 flex flex-col gap-1 border-t pt-2">{footer}</div>
          </nav>
        </SidePanelContent>
      </SidePanel>
      {palette ? (
        <CommandPalette
          open={palette}
          onOpenChange={(o) => {
            setPalette(o);
            if (!o) setQuery("");
          }}
          actions={actions}
          label={labels.palette}
          placeholder={labels.paletteHint}
          emptyText={labels.empty}
          onQueryChange={setQuery}
        />
      ) : null}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent title={labels.shortcuts} closeLabel={labels.close}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt>
              <kbd className="rounded border px-1.5">{PALETTE_KEYS}</kbd>
            </dt>
            <dd>{labels.palette}</dd>
            <dt>
              <kbd className="rounded border px-1.5">{HELP_KEY}</kbd>
            </dt>
            <dd>{labels.shortcuts}</dd>
            {sections.map((s) => (
              <div key={s.href} className="contents">
                <dt>
                  <kbd className="rounded border px-1.5">{s.shortcut}</kbd>
                </dt>
                <dd>{s.label}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
