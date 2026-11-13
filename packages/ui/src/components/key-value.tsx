import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type KeyValueItem = { label: ReactNode; value: ReactNode };

/** Label/value pairs as a description list (semantic for screen readers). */
export function KeyValue({
  items,
  columns = 1,
  className,
}: {
  items: KeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
