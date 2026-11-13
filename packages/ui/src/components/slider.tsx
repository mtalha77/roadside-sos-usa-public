"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export type SliderProps = ComponentProps<typeof SliderPrimitive.Root> & { "aria-label"?: string };

export function Slider({ className, "aria-label": ariaLabel, ...props }: SliderProps) {
  const thumbs = (props.value ?? props.defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex min-h-touch w-full touch-none items-center select-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-foreground" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbs }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={ariaLabel}
          className="block size-7 rounded-full border-2 border-foreground bg-surface shadow-md transition-transform duration-150 hover:scale-110"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
