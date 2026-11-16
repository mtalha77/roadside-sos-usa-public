import { demoMarkets } from "@rsos/config/demo-fixtures";
import { Badge } from "@rsos/ui/badge";
import { BoundaryPreview, type BoundaryFeature } from "@rsos/ui/boundary-preview";
import { CircleCheck, Circle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function load(slug: string) {
  const ctx = await getAdminContext();
  const market = ctx.markets.find((m) => m.slug === slug);
  if (!market) return null;
  const supabase = await getServerSupabase();
  const [{ data: row }, { data: phones }, { data: shapes }, { count: services }] =
    await Promise.all([
      supabase
        .from("markets")
        .select("coverage_hours, support_phone, state_code")
        .eq("id", market.id)
        .maybeSingle(),
      supabase
        .from("market_phone_numbers")
        .select("phone_number, purpose, is_active")
        .eq("market_id", market.id),
      (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown }>)(
        "admin_market_shapes",
      ),
      supabase
        .from("market_services")
        .select("id", { count: "exact", head: true })
        .eq("market_id", market.id),
    ]);
  const shape = (
    (Array.isArray(shapes) ? shapes : []) as { slug: string; boundary: unknown }[]
  ).find((s) => s.slug === slug);
  return { ctx, market, row, phones: phones ?? [], shape, services: services ?? 0 };
}

/**
 * Market detail (RSOS-077): boundary on a map, time zone, coverage hours, status, phone numbers per
 * source, rules, launch checklist and a coverage heatmap (demo). Market data is real.
 */
export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t, data] = await Promise.all([getTranslations("admin.markets"), load(slug)]);
  if (!data) notFound();
  const { market, row, phones, shape, services, ctx } = data;
  const hours = row?.coverage_hours as { always?: boolean } | null;
  const features: BoundaryFeature[] = shape?.boundary
    ? [{ geometry: shape.boundary as BoundaryFeature["geometry"] }]
    : [];
  const checklist = [
    { key: "boundary", ok: features.length > 0 },
    { key: "services", ok: services > 0 },
    { key: "phone", ok: phones.some((p) => p.is_active) || Boolean(row?.support_phone) },
    { key: "providers", ok: false },
    { key: "content", ok: true },
  ];
  const fx = demoMarkets[slug];
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{market.name}</h1>
        <Badge tone={market.status === "active" ? "success" : "info"}>
          {t(`status.${market.status}`)}
        </Badge>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="b-h">
            <h2 id="b-h" className="mb-3 font-semibold">
              {t("boundary")}
            </h2>
            {features.length ? (
              <BoundaryPreview features={features} label={t("boundaryOf", { name: market.name })} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("noBoundary")}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">{t("drawHint")}</p>
          </section>
          {ctx.demo && fx ? (
            <section className={card} aria-labelledby="h-h">
              <h2 id="h-h" className="mb-1 font-semibold">
                {t("heatmap")}
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">{t("heatmapDemo")}</p>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: "8rem repeat(24, minmax(0, 1fr))" }}
              >
                {fx.areas.map((a, i) => (
                  <div key={a.name} className="contents">
                    <span className="truncate pr-2 text-xs">{a.name}</span>
                    {Array.from({ length: 24 }, (_, h) => {
                      const v = (Math.sin((h + i * 3) / 3.8) + 1) / 2;
                      return (
                        <span
                          key={h}
                          title={`${a.name} ${h}:00`}
                          className="h-5 rounded-sm bg-success"
                          style={{ opacity: 0.15 + v * 0.85 }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="s-h">
            <h2 id="s-h" className="mb-3 font-semibold">
              {t("settings")}
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("timeZone")}</dt>
              <dd>{market.timeZone}</dd>
              <dt className="text-muted-foreground">{t("hours")}</dt>
              <dd>{hours?.always ? t("always") : t("custom")}</dd>
              <dt className="text-muted-foreground">{t("quoteWindow")}</dt>
              <dd>{t("quoteWindowValue")}</dd>
              <dt className="text-muted-foreground">{t("radius")}</dt>
              <dd>{t("radiusValue")}</dd>
            </dl>
          </section>
          <section className={card} aria-labelledby="p-h">
            <h2 id="p-h" className="mb-3 font-semibold">
              {t("phones")}
            </h2>
            {phones.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPhones")}</p>
            ) : (
              <ul className="text-sm">
                {phones.map((p) => (
                  <li key={p.phone_number} className="flex justify-between gap-2 py-1">
                    <span>{p.purpose}</span>
                    <span className="tabular-nums">{p.phone_number}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-labelledby="c-h">
            <h2 id="c-h" className="mb-3 font-semibold">
              {t("checklist")}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  {c.ok ? (
                    <CircleCheck aria-hidden="true" className="size-5 text-success" />
                  ) : (
                    <Circle aria-hidden="true" className="size-5 text-muted-foreground" />
                  )}
                  <span>
                    {t(`checks.${c.key}`)}
                    <span className="sr-only"> {c.ok ? t("done") : t("todo")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
