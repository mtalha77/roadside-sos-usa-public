"use client";

import {
  Briefcase,
  Home,
  LifeBuoy,
  LineChart,
  Menu,
  Settings2,
  Smartphone,
  User,
  Users,
  Wallet,
  Bell,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isBuilt } from "@/lib/routes";

export type NavLabels = Record<
  | "label"
  | "home"
  | "jobs"
  | "wallet"
  | "profile"
  | "more"
  | "services"
  | "team"
  | "insights"
  | "notifications"
  | "help"
  | "account"
  | "install",
  string
>;

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/**
 * Bottom tabs on phones (Home, Jobs, Wallet, Profile, More) and a side navigation on desktop for
 * office staff (RSOS-051). Operators don't see the wallet (owner and manager only).
 */
export function PortalNav({
  labels,
  company,
  canSeeMoney,
}: {
  labels: NavLabels;
  company: string;
  canSeeMoney: boolean;
}) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: labels.home, icon: Home },
    { href: "/jobs", label: labels.jobs, icon: Briefcase },
    ...(canSeeMoney ? [{ href: "/wallet", label: labels.wallet, icon: Wallet }] : []),
    { href: "/profile", label: labels.profile, icon: User },
    { href: "/more", label: labels.more, icon: Menu },
  ].filter((t) => isBuilt(t.href));
  const side = [
    ...tabs.filter((t) => t.href !== "/more"),
    { href: "/services", label: labels.services, icon: Tag },
    { href: "/team", label: labels.team, icon: Users },
    { href: "/insights", label: labels.insights, icon: LineChart },
    { href: "/notifications", label: labels.notifications, icon: Bell },
    { href: "/help", label: labels.help, icon: LifeBuoy },
    { href: "/account", label: labels.account, icon: Settings2 },
    { href: "/install", label: labels.install, icon: Smartphone },
  ].filter((t) => isBuilt(t.href));
  const item =
    "flex min-h-touch items-center gap-3 rounded-lg px-3 font-medium hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground";
  return (
    <>
      <nav
        aria-label={labels.label}
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r bg-surface p-3 md:flex"
      >
        <p className="mb-3 truncate px-3 pt-2 font-semibold">{company}</p>
        {side.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            aria-current={isActive(path, t.href) ? "page" : undefined}
            className={item}
          >
            <t.icon aria-hidden="true" className="size-5 text-muted-foreground" />
            {t.label}
          </Link>
        ))}
      </nav>
      <nav
        aria-label={labels.label}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            aria-current={isActive(path, t.href) ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground aria-[current=page]:text-foreground"
          >
            <t.icon aria-hidden="true" className="size-6" />
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
