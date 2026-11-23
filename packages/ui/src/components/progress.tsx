"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "../lib/cn";

export function Progress({
  value,
  label,
  className,
}: {
  value: number | null;
  label: string;
  className?: string;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={label}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full bg-foreground transition-transform duration-250 ease-standard",
          value === null && "w-1/3 animate-pulse",
        )}
        style={value === null ? undefined : { transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
