import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { EtaChip } from "./eta-chip";
import { PriceTag } from "./price-tag";
import { ProviderBadgeRow, type ProviderBadgeLabels, type ProviderSummary } from "./provider-card";
import { Skeleton } from "./skeleton";

export type Quote = {
  id: string;
  provider: ProviderSummary;
  /** All-in price in whole cents. */
  priceCents: number;
  etaMinutes: number;
  tag?: "fastest" | "best-price" | null;
};

export type QuoteCardLabels = ProviderBadgeLabels & {
  fastest: string;
  bestPrice: string;
  allIn: string;
  eta?: (minutes: number) => string;
  etaSr?: (minutes: number) => string;
  choose: (provider: string, price: string) => string;
};

export type QuoteCardProps = {
  quote: Quote;
  selected?: boolean;
  onSelect?: (quote: Quote) => void;
  labels?: Partial<QuoteCardLabels>;
  action?: ReactNode;
  className?: string;
};

const defaults: QuoteCardLabels = {
  insured: "Insured",
  licensed: "Licensed",
  rating: (r, c) => `Rated ${r.toFixed(1)} out of 5 from ${c} reviews`,
  noRatings: "New provider",
  fastest: "Fastest",
  bestPrice: "Best price",
  allIn: "all-in",
  choose: (p, price) => `Choose ${p} for ${price}`,
};

/** One provider's quote: who, how fast, how much. The whole card is the choice button. */
export function QuoteCard({
  quote,
  selected = false,
  onSelect,
  labels: overrides,
  action,
  className,
}: QuoteCardProps) {
  const labels = { ...defaults, ...overrides };
  const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    quote.priceCents / 100,
  );
  const Root = onSelect ? "button" : "div";
  return (
    <Root
      {...(onSelect
        ? {
            type: "button" as const,
            onClick: () => onSelect(quote),
            "aria-pressed": selected,
            "aria-label": labels.choose(quote.provider.name, price),
          }
        : {})}
      className={cn(
        "relative flex w-full flex-col gap-3 rounded-2xl border-2 bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-150 ease-standard sm:p-5",
        onSelect && "cursor-pointer hover:border-input hover:shadow-md",
        selected ? "border-primary shadow-md" : "border-border",
        className,
      )}
    >
      {quote.tag ? (
        <Badge tone="signal" className="absolute -top-3 left-4 shadow-sm">
          {quote.tag === "fastest" ? labels.fastest : labels.bestPrice}
        </Badge>
      ) : null}
      <div className="flex items-start gap-3">
        <Avatar name={quote.provider.name} src={quote.provider.photoUrl} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-lg font-semibold">{quote.provider.name}</p>
          <ProviderBadgeRow provider={quote.provider} labels={labels} />
        </div>
        <PriceTag cents={quote.priceCents} note={labels.allIn} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <EtaChip minutes={quote.etaMinutes} format={labels.eta} srLabel={labels.etaSr} />
        {action}
      </div>
    </Root>
  );
}

/** Placeholder while quotes load. */
export function QuoteCardSkeleton({ label = "Loading quote" }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-5"
    >
      <span className="sr-only">{label}</span>
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-7 w-16" />
      </div>
      <Skeleton className="h-7 w-24 rounded-full" />
    </div>
  );
}

/** Shown when a quote could not be loaded. */
export function QuoteCardError({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border-2 border-critical/40 bg-critical-subtle p-5 text-critical-strong"
    >
      <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
      <p className="flex-1 font-medium">{message}</p>
      {action}
    </div>
  );
}
