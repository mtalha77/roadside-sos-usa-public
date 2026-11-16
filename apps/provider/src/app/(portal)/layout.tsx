import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppRuntime } from "@/components/shell/app-runtime";
import { NightTheme } from "@/components/shell/night-theme";
import { type NavLabels, PortalNav } from "@/components/shell/portal-nav";
import { getPortalContext } from "@/lib/portal";

const NAV_KEYS = [
  "label",
  "home",
  "jobs",
  "wallet",
  "profile",
  "more",
  "services",
  "team",
  "insights",
  "notifications",
  "help",
  "account",
  "install",
  "theme",
  "signOut",
] as const;

/** Provider portal shell (RSOS-051): side navigation on desktop, bottom tabs on phones. */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [t, tc, ctx] = await Promise.all([
    getTranslations("portal"),
    getTranslations("common"),
    getPortalContext(),
  ]);
  const labels = Object.fromEntries(NAV_KEYS.map((k) => [k, t(`nav.${k}`)])) as NavLabels;
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {tc("skipToContent")}
      </a>
      <PortalNav labels={labels} company={ctx.company} canSeeMoney={ctx.canSeeMoney} />
      <div className="min-w-0 flex-1 pb-24 md:pb-8">{children}</div>
      <AppRuntime
        offlineLabel={t("shell.offline")}
        updateLabel={t("shell.update")}
        reloadLabel={t("shell.reload")}
      />
      <NightTheme />
    </div>
  );
}
