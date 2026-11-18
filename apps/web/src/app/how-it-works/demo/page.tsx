import { demoMarkets } from "@rsos/config/demo-fixtures";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { LiteMap } from "@rsos/ui/lite-map";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { DemoPlayer } from "@/components/demo/demo-player";
import { SitePage } from "@/components/site/site-page";
import { getServices } from "@/lib/site-data";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tours.web");
  return pageMetadata({ title: t("title"), description: t("lead"), path: "/how-it-works/demo" });
}

const fx = Object.values(demoMarkets)[0]!;
const where = fx.areas[0]!;
const names = fx.providers.slice(0, 2).map((p) => p.name.replace(/\s*\(demo\)$/, ""));

/**
 * "See how it works" (RSOS-105): a 30-second demo of a request, with made-up data, that plays on
 * its own and can be paused or skipped. "Get help now" stays on screen the whole time: someone
 * who is stuck can leave the demo with one tap. Tours never start on their own on the website.
 */
export default async function DemoPage() {
  const [t, th, ts, locale, services] = await Promise.all([
    getTranslations("tours.web"),
    getTranslations("home.hero"),
    getTranslations("site.services"),
    getLocale(),
    getServices(),
  ]);
  const slides = t.raw("slides") as { title: string; body: string }[];
  const offered = services.filter((s) => s.market_count > 0);
  const low = offered.find((s) => s.price_min_cents !== null)?.price_min_cents ?? null;
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const name = (s: string) => (ts.has(`${s}.name`) ? ts(`${s}.name`) : s);
  const box = "flex flex-col gap-3 rounded-2xl border bg-card p-4";
  const quotes = names.map((n, k) => ({
    n,
    eta: 18 + k * 9,
    price: low === null ? null : low + k * 1500,
  }));
  const pin = {
    id: "me",
    kind: "request" as const,
    lat: where.lat,
    lng: where.lng,
    label: where.name,
  };
  const visuals = [
    <ul key="v0" className="grid grid-cols-2 gap-2">
      {offered.slice(0, 6).map((s, k) => (
        <li
          key={s.slug}
          className={`flex min-h-16 items-center justify-center rounded-xl border-2 p-2 text-center font-semibold ${k === 1 ? "border-primary bg-primary/10" : ""}`}
        >
          {name(s.slug)}
        </li>
      ))}
    </ul>,
    <LiteMap key="v1" label={where.name} points={[pin]} radius={{ center: where, miles: 1 }} />,
    <ul key="v2" className="flex flex-col gap-2">
      {quotes.map((q) => (
        <li key={q.n} className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="font-semibold">{q.n}</span>
          <span className="text-right tabular-nums">
            {q.price !== null ? (
              <span className="block font-semibold">{money(q.price)}</span>
            ) : null}
            <span className="text-sm text-muted-foreground">{t("eta", { minutes: q.eta })}</span>
          </span>
        </li>
      ))}
    </ul>,
    <div
      key="v3"
      className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary p-3"
    >
      <span className="font-semibold">{quotes[0]!.n}</span>
      <span className="rounded-full bg-success-subtle px-3 py-1 text-sm font-semibold text-success-strong">
        {t("picked")}
      </span>
    </div>,
    <LiteMap
      key="v4"
      label={where.name}
      points={[pin]}
      route={{
        from: { lat: where.lat + 0.03, lng: where.lng - 0.04 },
        to: { lat: where.lat, lng: where.lng },
      }}
    />,
  ];
  return (
    <SitePage bar={false}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-28">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("lead")}</p>
        </header>
        <DemoPlayer
          slides={slides.map((s, k) => (
            <section key={s.title} className={box} aria-label={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <p className="text-muted-foreground">{s.body}</p>
              {visuals[k]}
            </section>
          ))}
          labels={{
            pause: t("pause"),
            play: t("play"),
            skip: t("skip"),
            progress: t("progress"),
            slide: String(t.raw("slide")),
          }}
          skipHref="/"
        />
      </div>
      {/* Visible the whole time: a person who is stuck leaves the demo with one tap. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Link
          href="/get-help"
          className="mx-auto flex min-h-13 max-w-2xl items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {th("getHelp")}
        </Link>
      </div>
    </SitePage>
  );
}
