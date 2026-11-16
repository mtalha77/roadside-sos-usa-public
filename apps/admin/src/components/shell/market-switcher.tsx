"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@rsos/ui/popover";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Choose one, several or all markets; every admin screen filters by the choice (a cookie). */
export function MarketSwitcher({
  markets,
  selected,
  labels,
}: {
  markets: { slug: string; name: string }[];
  selected: string[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(selected);
  const apply = (next: string[]) => {
    setChosen(next);
    const all = next.length === markets.length;
    document.cookie = `rsos_markets=${all ? "" : next.join(",")}; path=/; max-age=31536000; samesite=lax; secure`;
    router.refresh();
  };
  const summary =
    chosen.length === markets.length
      ? labels.allMarkets
      : chosen.length === 1
        ? markets.find((m) => m.slug === chosen[0])?.name
        : `${chosen.length} ${labels.marketsCount}`;
  return (
    <Popover>
      <PopoverTrigger className="flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent">
        <span className="sr-only">{labels.marketLabel}: </span>
        {summary}
        <ChevronDown aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">{labels.marketLabel}</legend>
          <button
            type="button"
            className="min-h-12 rounded-lg px-2 text-left text-sm hover:bg-accent"
            onClick={() => apply(markets.map((m) => m.slug))}
          >
            {labels.allMarkets}
          </button>
          {markets.map((m) => (
            <label
              key={m.slug}
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                className="size-5"
                checked={chosen.includes(m.slug)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...chosen, m.slug]
                    : chosen.filter((s) => s !== m.slug);
                  if (next.length) apply(next);
                }}
              />
              {m.name}
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
