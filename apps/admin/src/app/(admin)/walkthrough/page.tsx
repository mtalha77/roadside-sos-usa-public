import { demoMarkets } from "@rsos/config/demo-fixtures";
import { appUrl } from "@rsos/config/site";
import { demoStream } from "@rsos/core/demo";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { RunFullDemo } from "@/components/walkthrough/run-full-demo";
import { getAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Step = { key: string; app: "web" | "provider" | "admin"; path: string };

const STEPS: Record<"driver" | "provider" | "admin", Step[]> = {
  driver: [
    { key: "home", app: "web", path: "/" },
    { key: "city", app: "web", path: "{city}" },
    { key: "getHelp", app: "web", path: "/get-help" },
    { key: "tracking", app: "web", path: "/r/{token}" },
    { key: "account", app: "web", path: "/account" },
  ],
  provider: [
    { key: "signIn", app: "provider", path: "/sign-in" },
    { key: "onboarding", app: "provider", path: "/onboarding" },
    { key: "goOnline", app: "provider", path: "/" },
    { key: "offer", app: "provider", path: "/offer" },
    { key: "jobs", app: "provider", path: "/jobs?tab=active" },
    { key: "wallet", app: "provider", path: "/wallet" },
    { key: "prices", app: "provider", path: "/services" },
    { key: "profile", app: "provider", path: "/profile" },
    { key: "insights", app: "provider", path: "/insights" },
  ],
  admin: [
    { key: "adminSignIn", app: "admin", path: "/sign-in" },
    { key: "dispatch", app: "admin", path: "/dispatch" },
    { key: "request", app: "admin", path: "/requests/{token}" },
    { key: "intake", app: "admin", path: "/intake" },
    { key: "providers", app: "admin", path: "/providers" },
    { key: "recruitment", app: "admin", path: "/recruitment" },
    { key: "markets", app: "admin", path: "/markets" },
    { key: "pricing", app: "admin", path: "/pricing" },
    { key: "finance", app: "admin", path: "/finance" },
    { key: "analytics", app: "admin", path: "/analytics" },
    { key: "settings", app: "admin", path: "/settings" },
  ],
};

/**
 * The newest demo request in the demo provider company's market (the first fixture market), so
 * the driver, the provider portal and the admin all follow the same job from the start.
 */
function freshToken(now: number) {
  const market = Object.keys(demoMarkets)[0]!;
  return demoStream(now, { markets: [market] })[0]?.token ?? "";
}

async function loadContext() {
  return { ctx: await getAdminContext(), now: Date.now() };
}

/**
 * Staging walkthrough (RSOS-098, demo mode only): every screen of the three apps in the order a
 * real job happens, with direct links, and "Run full demo" to watch one job across all three.
 */
export default async function WalkthroughPage() {
  const [t, { ctx, now }] = await Promise.all([
    getTranslations("admin.walkthrough"),
    loadContext(),
  ]);
  if (!ctx.demo) notFound();
  const token = freshToken(now);
  const demoMarket =
    ctx.markets.find((m) => m.slug === Object.keys(demoMarkets)[0]) ?? ctx.markets[0];
  const city = demoMarket
    ? `/roadside-assistance/${demoMarket.stateCode.toLowerCase()}/${demoMarket.slug}`
    : "/";
  const href = (s: Step) =>
    `${appUrl(s.app)}${s.path.replace("{token}", encodeURIComponent(token)).replace("{city}", city)}`;
  return (
    <main id="main" className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>
      <RunFullDemo
        links={{
          web: href(STEPS.driver[3]!),
          provider: href(STEPS.provider[3]!),
          admin: href(STEPS.admin[2]!),
        }}
        labels={Object.fromEntries(
          [
            "run",
            "runHint",
            "openWeb",
            "openProvider",
            "openAdmin",
            "started",
            "stepsTitle",
            "stepsHint",
            "skip",
            "stage.quotes",
            "stage.picked",
            "stage.onTheWay",
            "stage.onSite",
            "stage.done",
          ].map((k) => [k, t(k)]),
        )}
      />
      {(["driver", "provider", "admin"] as const).map((group) => (
        <section
          key={group}
          aria-labelledby={`wt-${group}`}
          className="rounded-2xl border bg-card p-4 sm:p-5"
        >
          <h2 id={`wt-${group}`} className="mb-3 text-lg font-semibold">
            {t(`groups.${group}`)}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {STEPS[group].map((s) => (
              <li key={s.key}>
                <a
                  href={href(s)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center font-medium underline-offset-2 hover:underline"
                >
                  {t(`steps.${s.key}.title`)}
                </a>
                <p className="text-sm text-muted-foreground">{t(`steps.${s.key}.hint`)}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
