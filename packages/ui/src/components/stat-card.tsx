import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  /** Change vs. the previous period, e.g. "+12%". */
  change?: { value: string; direction: "up" | "down"; good: boolean };
  hint?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, change, hint, className }: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {change ? (
        <p
          className={cn(
            "inline-flex items-center gap-1 text-sm font-semibold",
            change.good ? "text-success-strong" : "text-critical-strong",
          )}
        >
          {change.direction === "up" ? (
            <ArrowUpRight aria-hidden="true" className="size-4" />
          ) : (
            <ArrowDownRight aria-hidden="true" className="size-4" />
          )}
          {change.value}
        </p>
      ) : null}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
