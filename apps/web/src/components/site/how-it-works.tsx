import { QuoteCard } from "@rsos/ui/quote-card";
import { StatusPill } from "@rsos/ui/status-pill";
import { Timeline } from "@rsos/ui/timeline";
import { getTranslations } from "next-intl/server";

/**
 * Three steps shown with the real product components. The quote is clearly an example: its price
 * is a real local price (from the market's range) and it shows no invented rating or arrival time.
 */
export async function HowItWorks({ examplePriceCents }: { examplePriceCents: number | null }) {
  const t = await getTranslations("home");
  const steps = [
    { n: 1, title: t("how.step1"), body: t("how.step1Body") },
    { n: 2, title: t("how.step2"), body: t("how.step2Body") },
    { n: 3, title: t("how.step3"), body: t("how.step3Body") },
  ];
  const statuses = ["submitted", "quoted", "accepted", "en_route"] as const;
  return (
    <section aria-labelledby="how-title" className="flex flex-col gap-6">
      <h2 id="how-title" className="text-3xl font-semibold">
        {t("how.title")}
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ol className="flex min-w-0 flex-col gap-5">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground tabular-nums"
              >
                {s.n}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex min-w-0 flex-col gap-4">
          {examplePriceCents !== null ? (
            <figure className="flex flex-col gap-2" aria-label={t("how.exampleLabel")}>
              <QuoteCard
                quote={{
                  id: "example",
                  provider: {
                    name: t("how.exampleProvider"),
                    rating: null,
                    reviewCount: 0,
                    insured: true,
                    licensed: true,
                  },
                  priceCents: examplePriceCents,
                  etaMinutes: 0,
                }}
                labels={{
                  eta: () => t("how.exampleEta"),
                  etaSr: () => t("how.exampleEtaSr"),
                  insured: t("how.labels.insured"),
                  licensed: t("how.labels.licensed"),
                  noRatings: t("how.labels.noRatings"),
                  allIn: t("how.labels.allIn"),
                }}
              />
              <figcaption className="text-sm text-muted-foreground">
                {t("how.exampleNote")}
              </figcaption>
            </figure>
          ) : null}
          <figure className="rounded-2xl border bg-card p-5" aria-label={t("how.trackingLabel")}>
            <Timeline
              items={statuses.map((s) => ({
                id: s,
                title: t(`tracking.${s}`),
                time: <StatusPill status={s} label={t(`trackingPill.${s}`)} />,
                tone: s === "en_route" ? "info" : "success",
              }))}
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
