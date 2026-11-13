"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "../lib/cn";

/** Photo with an initials fallback while it loads or if it fails (needs the browser). */
export function AvatarPhoto({
  src,
  name,
  initials,
  className,
}: {
  src: string;
  name: string;
  initials: string;
  className: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />
      <AvatarPrimitive.Fallback
        className="grid size-full place-items-center font-semibold text-foreground"
        aria-label={name}
        role="img"
      >
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
