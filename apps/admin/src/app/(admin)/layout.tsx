import { canSee } from "@rsos/config/permissions";
import { textingEnabled } from "@rsos/core/adapters";
import { LogOut, Map as MapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { readTourProgress, shouldAutoStart } from "@rsos/db/tours";
import { AdminShell } from "@/components/shell/admin-shell";
import { AdminTours, TakeTourButton } from "@/components/tours/admin-tours";
import { DemoControls } from "@/components/shell/demo-controls";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin";
import { readDemoClock } from "@/lib/demo-clock";
import { signOutAction } from "@/lib/auth-actions";
import { NAV_GROUPS, sectionsFor } from "@/lib/nav";
import { buildSteps, PAGE_TOURS, ROLE_TOURS, roleTourFor } from "@/lib/tours";

const SHELL_KEYS = [
  "nav",
  "navMobile",
  "menu",
  "skip",
  "account",
  "collapse",
  "search",
  "palette",
  "paletteHint",
  "empty",
  "pages",
  "find",
  "findRequest",
  "findProvider",
  "actions",
  "toggleTheme",
  "shortcuts",
  "close",
  "allMarkets",
  "marketsCount",
  "marketLabel",
] as const;
const DEMO_KEYS = [
  "title",
  "hint",
  "close",
  "paused",
  "running",
  "pause",
  "resume",
  "skip",
  "reset",
  "load",
  "loadOn",
] as const;

/** Sign out, at the bottom of the menu for every role (the overview page used to hold it). */
function SignOut({ label }: { label: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
      >
        <LogOut aria-hidden="true" className="size-5 shrink-0" />
        <span>{label}</span>
      </button>
    </form>
  );
}

/** Admin shell for every signed-in screen (RSOS-071). The proxy already requires staff with aal2. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [t, ta, ctx, clock, jar] = await Promise.all([
    getTranslations("admin"),
    getTranslations("auth"),
    getAdminContext(),
    readDemoClock(),
    cookies(),
  ]);
  const labels = Object.fromEntries(SHELL_KEYS.map((k) => [k, t(`shell.${k}`)]));
  // "Dispatcher · San Antonio, Houston": the role and the markets this person may see (RSOS-102).
  const roleLabel = t.has(`roles.${ctx.role}.name`) ? t(`roles.${ctx.role}.name`) : ctx.role;
  const identity = `${roleLabel} · ${
    ctx.allMarkets ? t("roles.allMarkets") : ctx.markets.map((m) => m.name).join(", ")
  }`;
  // RSOS-105: the role tour runs once on first sign-in; "?" buttons run the page tours.
  const [tt, progress] = await Promise.all([
    getTranslations("tours"),
    readTourProgress(await getServerSupabase()),
  ]);
  const roleTour = roleTourFor(ctx.role);
  type Texts = { title: string; body: string }[];
  const tours = [
    {
      id: `admin.${roleTour}`,
      steps: buildSteps(ROLE_TOURS[roleTour], tt.raw(`admin.${roleTour}`) as Texts),
      autoStart: shouldAutoStart(progress, `admin.${roleTour}`),
    },
    ...Object.entries(PAGE_TOURS).map(([page, targets]) => ({
      id: `admin.page.${page}`,
      steps: buildSteps(targets, tt.raw(`admin.page.${page}`) as Texts),
      autoStart: false,
    })),
  ];
  const tourLabels = {
    back: tt("labels.back"),
    next: tt("labels.next"),
    done: tt("labels.done"),
    skip: tt("labels.skip"),
    hide: tt("labels.hide"),
    step: String(tt.raw("labels.step")),
  };
  // Everyone who answers calls gets the softphone dock (RSOS-074b).
  const dispatches = ["super_admin", "ops_manager", "dispatcher"].includes(ctx.role);
  // RSOS-035: until A2P 10DLC is approved (or overridden), texts to real drivers are held.
  const { data: a2p } = await (
    await getServerSupabase()
  )
    .from("system_settings")
    .select("value")
    .eq("key", "a2p_10dlc")
    .maybeSingle();
  const a2pValue = (a2p?.value ?? {}) as { status?: unknown; override?: unknown };
  // Texting is off in batch 4 (owner scope change): no banner until TEXTING_ENABLED.
  const textingLimited =
    textingEnabled() &&
    a2p !== null &&
    a2pValue.status !== "approved" &&
    a2pValue.override !== true;
  const { data: myStatus } = dispatches
    ? await (
        await getServerSupabase()
      )
        .from("dispatcher_status")
        .select("presence")
        .eq("user_id", ctx.userId)
        .maybeSingle()
    : { data: null };
  return (
    <AdminShell
      sections={sectionsFor(ctx.role).map((s) => ({ ...s, label: t(`sections.${s.key}`) }))}
      groups={Object.fromEntries(NAV_GROUPS.map((g) => [g, t(`shell.groups.${g}`)]))}
      identity={identity}
      markets={ctx.markets.map((m) => ({ slug: m.slug, name: m.name }))}
      selected={ctx.selected}
      labels={labels}
      footer={
        <>
          <TakeTourButton tour={`admin.${roleTour}`} label={tt("labels.take")} />
          {ctx.demo ? (
            <>
              {canSee(ctx.role, "walkthrough") ? (
                <Link
                  href="/walkthrough"
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  <MapIcon aria-hidden="true" className="size-5 shrink-0" />
                  <span>{t("sections.walkthrough")}</span>
                </Link>
              ) : null}
              <DemoControls
                initial={clock}
                loadTest={jar.get("rsos_demo_load")?.value === "1"}
                labels={Object.fromEntries(DEMO_KEYS.map((k) => [k, t(`demoControls.${k}`)]))}
              />
            </>
          ) : null}
          <SignOut label={ta("signOut")} />
        </>
      }
    >
      {textingLimited ? (
        <p
          role="status"
          className="mx-4 mt-3 rounded-xl border border-warning bg-warning-subtle px-4 py-2 text-sm font-medium text-warning-strong"
        >
          <Link href="/settings?tab=templates" className="underline underline-offset-2">
            {t("textingLimited")}
          </Link>
        </p>
      ) : null}
      {children}
      {dispatches ? <SoftphoneDock initialPresence={myStatus?.presence ?? "away"} /> : null}
      <AdminTours tours={tours} labels={tourLabels} />
    </AdminShell>
  );
}
