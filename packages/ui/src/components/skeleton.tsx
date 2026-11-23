import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Loading placeholder. Pair with an aria-busy container or a visually hidden "Loading" label. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}
