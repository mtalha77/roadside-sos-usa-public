"use client";

import { ProviderLogo, type ProviderLogoData } from "@rsos/ui/provider-logo";
import {
  Bell,
  Briefcase,
  Home,
  LifeBuoy,
  LineChart,
  LogOut,
  Menu,
  Settings2,
  Smartphone,
  Tag,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { providerCanSee, providerSectionForPath } from "@rsos/config/permissions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isBuilt } from "@/lib/routes";
import { signOutAction } from "@/lib/auth-actions";
import { ThemeSwitch } from "./theme-switch";

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
  | "install"
  | "theme"
  | "signOut"
  | "myJobs",
  string
>;

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/**
 * Bottom tabs on phones (Home, Jobs, Wallet, Profile, More) and a side navigation on desktop for
 * office staff (RSOS-051), filtered by role (RSOS-104). Technicians get a simple top bar with
 * only "My jobs" and their account: their phone shows the job, nothing else.
 */
export function PortalNav({
  labels,
  company,
  companyLogo,
  role,
}: {
  labels: NavLabels;
  company: string;
  companyLogo?: ProviderLogoData | null;
  role: string;
}) {
  const path = usePathname();
  const allowed = (href: string) => {
    const section = providerSectionForPath(href);
    return isBuilt(href) && (section === null || providerCanSee(role, section));
  };
  if (role === "operator")
    return (
      <header className="fixed inset-x-0 top-0 z-40 flex min-h-14 items-center gap-2 border-b bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <p className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
          {companyLogo ? <ProviderLogo logo={companyLogo} size={28} /> : null}
          <span className="truncate">{company}</span>
        </p>
        <nav aria-label={labels.label} className="flex items-center gap-1">
          <Link
            href="/jobs"
            aria-current={isActive(path, "/jobs") ? "page" : undefined}
            className="flex min-h-touch items-center gap-2 rounded-lg px-3 font-medium aria-[current=page]:bg-accent"
          >
            <Briefcase aria-hidden="true" className="size-5" />
            {labels.myJobs}
          </Link>
          <Link
            href="/account"
            aria-label={labels.account}
            aria-current={isActive(path, "/account") ? "page" : undefined}
            className="grid min-h-touch min-w-touch place-items-center rounded-lg aria-[current=page]:bg-accent"
          >
            <User aria-hidden="true" className="size-5" />
          </Link>
        </nav>
      </header>
    );
  const tabs = [
    { href: "/", label: labels.home, icon: Home },
    { href: "/jobs", label: labels.jobs, icon: Briefcase },
    { href: "/wallet", label: labels.wallet, icon: Wallet },
    { href: "/profile", label: labels.profile, icon: User },
    { href: "/more", label: labels.more, icon: Menu },
  ].filter((t) => allowed(t.href));
  const side = [
    ...tabs.filter((t) => t.href !== "/more"),
    { href: "/services", label: labels.services, icon: Tag },
    { href: "/team", label: labels.team, icon: Users },
    { href: "/insights", label: labels.insights, icon: LineChart },
    { href: "/notifications", label: labels.notifications, icon: Bell },
    { href: "/help", label: labels.help, icon: LifeBuoy },
    { href: "/account", label: labels.account, icon: Settings2 },
    { href: "/install", label: labels.install, icon: Smartphone },
  ].filter((t) => allowed(t.href));
  const item =
    "flex min-h-touch items-center gap-3 rounded-lg px-3 font-medium hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground";
  return (
    <>
      <nav
        aria-label={labels.label}
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r bg-surface p-3 md:flex"
      >
        <p className="mb-3 flex items-center gap-2 px-3 pt-2 font-semibold">
          {companyLogo ? <ProviderLogo logo={companyLogo} size={32} /> : null}
          <span className="truncate">{company}</span>
        </p>
        {side.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(path, t.href) ? "page" : undefined}
            className={item}
          >
            <t.icon aria-hidden="true" className="size-5 text-muted-foreground" />
            {t.label}
          </Link>
        ))}
        <ThemeSwitch label={labels.theme} className={`${item} mt-auto text-left`} />
        <form action={signOutAction}>
          <button type="submit" className={`${item} w-full text-left`}>
            <LogOut aria-hidden="true" className="size-5 text-muted-foreground" />
            {labels.signOut}
          </button>
        </form>
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
