import { BadgeCheck, ShieldCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Avatar } from "./avatar";

export type ProviderBadgeLabels = {
  insured: string;
  licensed: string;
  rating: (rating: number, count: number) => string;
  noRatings: string;
};

export const defaultProviderBadgeLabels: ProviderBadgeLabels = {
  insured: "Insured",
  licensed: "Licensed",
  rating: (r, c) => `Rated ${r.toFixed(1)} out of 5 from ${c} reviews`,
  noRatings: "New provider",
};

export type ProviderSummary = {
  name: string;
  photoUrl?: string | null;
  rating: number | null;
  reviewCount: number;
  insured: boolean;
  licensed: boolean;
};

/** Rating plus trust badges. Shows "New provider" instead of a fake rating when there are no reviews. */
export function ProviderBadgeRow({
  provider,
  labels = defaultProviderBadgeLabels,
  className,
}: {
  provider: ProviderSummary;
  labels?: ProviderBadgeLabels;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
      <li className="inline-flex items-center gap-1 font-semibold tabular-nums">
        {provider.rating !== null && provider.reviewCount > 0 ? (
          <>
            <Star aria-hidden="true" className="size-4 fill-current text-signal-strong" />
            <span aria-hidden="true">
              {provider.rating.toFixed(1)}{" "}
              <span className="font-normal text-muted-foreground">({provider.reviewCount})</span>
            </span>
            <span className="sr-only">{labels.rating(provider.rating, provider.reviewCount)}</span>
          </>
        ) : (
          <span className="font-normal text-muted-foreground">{labels.noRatings}</span>
        )}
      </li>
      {provider.insured ? (
        <li className="inline-flex items-center gap-1 text-success-strong">
          <ShieldCheck aria-hidden="true" className="size-4" />
          {labels.insured}
        </li>
      ) : null}
      {provider.licensed ? (
        <li className="inline-flex items-center gap-1 text-info-strong">
          <BadgeCheck aria-hidden="true" className="size-4" />
          {labels.licensed}
        </li>
      ) : null}
    </ul>
  );
}

export function ProviderCard({
  provider,
  meta,
  action,
  labels,
  className,
}: {
  provider: ProviderSummary;
  meta?: ReactNode;
  action?: ReactNode;
  labels?: ProviderBadgeLabels;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm", className)}
    >
      <Avatar name={provider.name} src={provider.photoUrl} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-lg font-semibold">{provider.name}</p>
        <ProviderBadgeRow provider={provider} labels={labels} />
        {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {action}
    </div>
  );
}
