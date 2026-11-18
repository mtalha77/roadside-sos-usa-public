"use client";

import { CommandPalette, type CommandAction } from "@rsos/ui/command-palette";
import { Dialog, DialogContent } from "@rsos/ui/dialog";
import { ThemeToggle } from "@rsos/ui/theme-toggle";
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  FileText,
  Gauge,
  Inbox,
  MessagesSquare,
  Map as MapIcon,
  Megaphone,
  Target,
  Phone,
  Radio,
  Search,
  Settings,
  Star,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { MarketSwitcher } from "./market-switcher";

const ICONS = {
  inbox: MessagesSquare,
  dispatch: Radio,
  requests: Inbox,
  intake: Phone,
  providers: Truck,
  recruitment: UserPlus,
  markets: MapIcon,
  pricing: DollarSign,
  finance: Wallet,
  reviews: Star,
  analytics: BarChart3,
  marketing: Megaphone,
  campaign: Target,
  content: FileText,
  team: Users,
  settings: Settings,
} as const;

const PALETTE_KEYS = "⌘K";
const HELP_KEY = "?";

type Section = { href: string; key: keyof typeof ICONS; label: string; shortcut: string };

/**
 * Admin shell (RSOS-071): collapsible sidebar, market switcher, Cmd+K command palette (pages,
 * find a request by code or phone, a provider by name), "g then letter" shortcuts and a "?"
 * cheat sheet. Light and dark.
 */
export function AdminShell({
  sections,
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
  const [query, setQuery] = useState("");
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
  const q = query.trim();
  const actions: CommandAction[] = [
    ...sections.map((s) => ({
      id: s.href,
      label: s.label,
      group: labels.pages!,
      shortcut: s.shortcut,
      onSelect: () => router.push(s.href),
    })),
    { id: "/", label: labels.overview!, group: labels.pages!, onSelect: () => router.push("/") },
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
        <Link href="/" className={item} aria-current={path === "/" ? "page" : undefined}>
          <Gauge aria-hidden="true" className="size-5 shrink-0" />
          <span className={collapsed ? "sr-only" : undefined}>{labels.overview}</span>
        </Link>
        {sections.map((s) => {
          const Icon = ICONS[s.key];
          return (
            <Link
              key={s.href}
              href={s.href}
              prefetch={false}
              className={item}
              aria-current={path === s.href || path.startsWith(`${s.href}/`) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className={collapsed ? "sr-only" : undefined}>{s.label}</span>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
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
          <nav
            aria-label={labels.navMobile}
            className="flex w-full gap-1 overflow-x-auto md:hidden"
          >
            {sections.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                prefetch={false}
                className="flex min-h-12 shrink-0 items-center rounded-lg px-3 text-sm font-medium aria-[current=page]:bg-accent"
                aria-current={path.startsWith(s.href) ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
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
