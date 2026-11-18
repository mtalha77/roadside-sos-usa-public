import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppRuntime } from "@/components/shell/app-runtime";
import { NightTheme } from "@/components/shell/night-theme";
import { type NavLabels, PortalNav } from "@/components/shell/portal-nav";
import { readTourProgress, shouldAutoStart } from "@rsos/db/tours";
import { PortalTour, TakeTourButton } from "@/components/tours/portal-tour";
import { getPortalContext } from "@/lib/portal";
import { getServerSupabase } from "@/lib/supabase/server";
import { providerSteps } from "@/lib/tours";

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
  "myJobs",
] as const;

/** Provider portal shell (RSOS-051): side navigation on desktop, bottom tabs on phones. */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const [t, tc, tt, ctx, progress] = await Promise.all([
    getTranslations("portal"),
    getTranslations("common"),
    getTranslations("tours"),
    getPortalContext(),
    getServerSupabase().then(readTourProgress),
  ]);
  // RSOS-105: the role's tour runs once on first sign-in; "Take the tour" restarts it.
  const tourId = `provider.${ctx.role}`;
  const tourLabels = {
    back: tt("labels.back"),
    next: tt("labels.next"),
    done: tt("labels.done"),
    skip: tt("labels.skip"),
    hide: tt("labels.hide"),
    step: String(tt.raw("labels.step")),
  };
  const labels = Object.fromEntries(NAV_KEYS.map((k) => [k, t(`nav.${k}`)])) as NavLabels;
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {tc("skipToContent")}
      </a>
      <PortalNav
        labels={labels}
        company={ctx.company}
        companyLogo={ctx.companyLogo}
        role={ctx.role}
        extra={
          <TakeTourButton
            tour={tourId}
            label={tt("labels.take")}
            className="flex min-h-touch w-full items-center gap-3 rounded-lg px-3 text-left font-medium hover:bg-accent"
          />
        }
      />
      <div className={`min-w-0 flex-1 ${ctx.role === "operator" ? "pt-16 pb-8" : "pb-24 md:pb-8"}`}>
        {children}
      </div>
      <AppRuntime
        offlineLabel={t("shell.offline")}
        updateLabel={t("shell.update")}
        reloadLabel={t("shell.reload")}
      />
      <NightTheme />
      <PortalTour
        id={tourId}
        steps={providerSteps(
          ctx.role,
          tt.raw(`provider.${ctx.role}`) as { title: string; body: string }[],
        )}
        labels={tourLabels}
        autoStart={shouldAutoStart(progress, tourId)}
      />
    </div>
  );
}
