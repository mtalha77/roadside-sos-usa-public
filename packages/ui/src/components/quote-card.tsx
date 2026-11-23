import { BadgeCheck, Check, CircleAlert, ShieldCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Avatar } from "./avatar";
import type { ProviderBadgeLabels, ProviderSummary } from "./provider-card";
import { ProviderLogo } from "./provider-logo";
import { Skeleton } from "./skeleton";

export type Quote = {
  id: string;
  provider: ProviderSummary;
  /** All-in price in whole cents. */
  priceCents: number;
  etaMinutes: number;
  tag?: "fastest" | "best-price" | "top-rated" | null;
  /** Distance from the driver, in miles. */
  distanceMiles?: number | null;
};

export type QuoteCardLabels = ProviderBadgeLabels & {
  fastest: string;
  bestPrice: string;
  topRated: string;
  allIn: string;
  arrives: string;
  eta?: (minutes: number) => string;
  etaSr?: (minutes: number) => string;
  choose: (provider: string, price: string) => string;
  reviews: (count: number) => string;
  years: (count: number) => string;
  trucks: (count: number) => string;
  distance: (miles: number) => string;
  selected: string;
};

export type QuoteCardProps = {
  quote: Quote;
  selected?: boolean;
  onSelect?: (quote: Quote) => void;
  labels?: Partial<QuoteCardLabels>;
  /** Extra controls under the card (outside the main button, e.g. "Compare"). */
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
  topRated: "Top rated",
  allIn: "all-in",
  arrives: "arrives in",
  choose: (p, price) => `${p}, ${price}. View profile`,
  reviews: (c) => `${c} reviews`,
  years: (c) => `${c} yrs in business`,
  trucks: (c) => `${c} trucks`,
  distance: (m) => `${m.toFixed(1)} mi away`,
  selected: "Selected",
};

/**
 * One provider's quote, calm and scannable: who (logo, name, rating), then the two numbers that
 * decide (arrival time and all-in price, largest, monospaced), then trust facts, then a tag and
 * distance. The whole card is one button; extra controls sit below it, outside the button.
 */
export function QuoteCard({
  quote,
  selected = false,
  onSelect,
  labels: overrides,
  action,
  className,
}: QuoteCardProps) {
  const labels = { ...defaults, ...overrides };
  const p = quote.provider;
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: quote.priceCents % 100 === 0 ? 0 : 2,
  }).format(quote.priceCents / 100);
  const eta = labels.eta ? labels.eta(quote.etaMinutes) : `${quote.etaMinutes} min`;
  const Root = onSelect ? "button" : "div";
  const tag =
    quote.tag === "fastest"
      ? labels.fastest
      : quote.tag === "best-price"
        ? labels.bestPrice
        : quote.tag === "top-rated"
          ? labels.topRated
          : null;
  const facts = [
    p.insured ? { key: "insured", icon: ShieldCheck, text: labels.insured } : null,
    p.licensed ? { key: "licensed", icon: BadgeCheck, text: labels.licensed } : null,
    p.yearsInBusiness ? { key: "years", icon: null, text: labels.years(p.yearsInBusiness) } : null,
    p.trucks ? { key: "trucks", icon: null, text: labels.trucks(p.trucks) } : null,
  ].filter((x) => x !== null);
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-card transition-colors duration-150 ease-standard",
        selected ? "border-foreground ring-1 ring-foreground" : "border-border",
        className,
      )}
    >
      <Root
        {...(onSelect
          ? {
              type: "button" as const,
              onClick: () => onSelect(quote),
              "aria-pressed": selected,
              "aria-label": labels.choose(p.name, price),
            }
          : {})}
        className={cn(
          "flex min-h-touch w-full flex-col gap-4 rounded-2xl p-4 text-left sm:p-5",
          onSelect &&
            "cursor-pointer hover:bg-accent/60 active:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <div className="flex items-center gap-3">
          {p.logo ? (
            <ProviderLogo logo={p.logo} size={44} />
          ) : (
            <Avatar name={p.name} src={p.photoUrl} />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-lg leading-tight font-semibold">{p.name}</p>
            {p.rating !== null && p.reviewCount > 0 ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star aria-hidden="true" className="size-4 fill-current text-foreground" />
                <span aria-hidden="true">
                  <span className="font-semibold text-foreground tabular-nums">
                    {p.rating.toFixed(1)}
                  </span>
                  {" · "}
                  {labels.reviews(p.reviewCount)}
                </span>
                <span className="sr-only">{labels.rating(p.rating, p.reviewCount)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{labels.noRatings}</p>
            )}
          </div>
          {selected ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <Check aria-hidden="true" className="size-5" />
              {labels.selected}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {labels.arrives}
            </p>
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              <span aria-hidden={labels.etaSr ? true : undefined}>{eta}</span>
              {labels.etaSr ? (
                <span className="sr-only">{labels.etaSr(quote.etaMinutes)}</span>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {labels.allIn}
            </p>
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{price}</p>
          </div>
        </div>
        {facts.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {facts.map((f) => (
              <li key={f.key} className="inline-flex items-center gap-1">
                {f.icon ? <f.icon aria-hidden="true" className="size-4" /> : null}
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        {tag || quote.distanceMiles ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            {tag ? (
              <span className="rounded-full bg-info-subtle px-2.5 py-0.5 font-semibold text-info-strong">
                {tag}
              </span>
            ) : (
              <span />
            )}
            {quote.distanceMiles ? (
              <span className="text-muted-foreground tabular-nums">
                {labels.distance(quote.distanceMiles)}
              </span>
            ) : null}
          </div>
        ) : null}
      </Root>
      {action ? <div className="border-t px-4 py-2 sm:px-5">{action}</div> : null}
    </div>
  );
}

/** Placeholder while quotes load. */
export function QuoteCardSkeleton({ label = "Loading quote" }: { label?: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24 justify-self-end" />
      </div>
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/** Shown when a quote could not be loaded. */
export function QuoteCardError({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border border-critical/40 bg-critical-subtle p-5 text-critical-strong"
    >
      <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
      <p className="flex-1 font-medium">{message}</p>
      {action}
    </div>
  );
}
