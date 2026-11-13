"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors duration-200 ease-standard data-[state=checked]:bg-success before:absolute before:-inset-2 before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-7 rounded-full bg-surface shadow-md transition-transform duration-200 ease-emphasized data-[state=checked]:translate-x-6" />
    </SwitchPrimitive.Root>
  );
}
