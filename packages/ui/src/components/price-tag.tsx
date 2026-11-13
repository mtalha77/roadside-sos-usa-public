import { cn } from "../lib/cn";

export type PriceTagProps = {
  /** Whole cents. */
  cents: number;
  currency?: string;
  locale?: string;
  size?: "sm" | "md" | "lg";
  /** Small text under the price, e.g. "all-in". */
  note?: string;
  className?: string;
};

const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-display-sm" };

/** Money with tabular digits so prices line up and never jump. */
export function PriceTag({
  cents,
  currency = "USD",
  locale = "en-US",
  size = "md",
  note,
  className,
}: PriceTagProps) {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return (
    <span className={cn("inline-flex flex-col items-end leading-none", className)}>
      <span className={cn("font-semibold tabular-nums", sizes[size])}>{formatted}</span>
      {note ? <span className="mt-1 text-xs text-muted-foreground">{note}</span> : null}
    </span>
  );
}
