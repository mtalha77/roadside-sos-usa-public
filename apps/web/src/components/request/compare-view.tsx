"use client";

import type { DemoQuote } from "@rsos/core/demo";
import { Button } from "@rsos/ui/button";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import { SidePanel, SidePanelContent } from "@rsos/ui/side-panel";
import { useFormatter, useTranslations } from "next-intl";

/** Up to three quotes side by side, each with its own "Choose". */
export function CompareView({
  quotes,
  open,
  milesTo,
  onClose,
  onChoose,
}: {
  quotes: DemoQuote[];
  open: boolean;
  milesTo: (q: DemoQuote) => number;
  onClose: () => void;
  onChoose: (q: DemoQuote) => void;
}) {
  const t = useTranslations("track.compare");
  const f = useFormatter();
  const money = (c: number) => f.number(c / 100, { style: "currency", currency: "USD" });
  const rows: { key: string; label: string; value: (q: DemoQuote) => string }[] = [
    { key: "eta", label: t("eta"), value: (q) => t("minutes", { minutes: q.etaMinutes }) },
    { key: "price", label: t("price"), value: (q) => money(q.priceCents) },
    {
      key: "rating",
      label: t("rating"),
      value: (q) =>
        q.provider.rating
          ? t("ratingValue", { rating: q.provider.rating.toFixed(1), count: q.provider.reviews })
          : t("new"),
    },
    { key: "years", label: t("years"), value: (q) => String(q.provider.years) },
    { key: "trucks", label: t("trucks"), value: (q) => String(q.provider.trucks) },
    { key: "distance", label: t("distance"), value: (q) => t("miles", { miles: milesTo(q) }) },
  ];
  return (
    <SidePanel open={open} onOpenChange={(o) => (o ? null : onClose())}>
      {open ? (
        <SidePanelContent title={t("title")} closeLabel={t("close")} className="md:w-[44rem]">
          <div
            tabIndex={0}
            role="region"
            aria-label={t("title")}
            className="overflow-x-auto rounded-2xl border bg-card"
          >
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead>
                <tr className="border-b">
                  <td />
                  {quotes.map((q) => (
                    <th key={q.id} scope="col" className="p-3 text-left align-top font-semibold">
                      <ProviderLogo logo={q.provider.logo} size={36} className="mb-2" />
                      {q.provider.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="p-3 text-left font-medium text-muted-foreground">
                      {r.label}
                    </th>
                    {quotes.map((q) => (
                      <td
                        key={q.id}
                        className={
                          "p-3 tabular-nums " +
                          (r.key === "eta" || r.key === "price"
                            ? "font-mono text-lg font-semibold"
                            : "")
                        }
                      >
                        {r.value(q)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {quotes.map((q) => (
                    <td key={q.id} className="p-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => onChoose(q)}
                      >
                        {t("choose")}
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </SidePanelContent>
      ) : null}
    </SidePanel>
  );
}
