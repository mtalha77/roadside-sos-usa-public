import { Map as MapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { DemoControls } from "@/components/shell/demo-controls";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin";
import { readDemoClock } from "@/lib/demo-clock";
import { BUILT, builtSections } from "@/lib/nav";

const WALKTHROUGH_BUILT = BUILT.has("/walkthrough");

const SHELL_KEYS = [
  "nav",
  "navMobile",
  "skip",
  "overview",
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
] as const;

/** Admin shell for every signed-in screen (RSOS-071). The proxy already requires staff with aal2. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [t, ctx, clock] = await Promise.all([
    getTranslations("admin"),
    getAdminContext(),
    readDemoClock(),
  ]);
  const labels = Object.fromEntries(SHELL_KEYS.map((k) => [k, t(`shell.${k}`)]));
  // Everyone who answers calls gets the softphone dock (RSOS-074b).
  const dispatches = ["super_admin", "ops_manager", "dispatcher"].includes(ctx.role);
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
      sections={builtSections().map((s) => ({ ...s, label: t(`sections.${s.key}`) }))}
      markets={ctx.markets.map((m) => ({ slug: m.slug, name: m.name }))}
      selected={ctx.selected}
      labels={labels}
      footer={
        ctx.demo ? (
          <>
            {WALKTHROUGH_BUILT ? (
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
              labels={Object.fromEntries(DEMO_KEYS.map((k) => [k, t(`demoControls.${k}`)]))}
            />
          </>
        ) : null
      }
    >
      {children}
      {dispatches ? <SoftphoneDock initialPresence={myStatus?.presence ?? "away"} /> : null}
    </AdminShell>
  );
}
