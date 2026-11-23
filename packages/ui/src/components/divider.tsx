import { Separator } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Divider({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof Separator.Root>) {
  return (
    <Separator.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
