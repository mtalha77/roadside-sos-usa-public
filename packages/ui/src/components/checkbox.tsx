"use client";

import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "../lib/cn";

export type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root> & { label?: ReactNode };

/** Checkbox with its label inside a 48px-tall hit area. */
export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const auto = useId();
  const cid = id ?? auto;
  const box = (
    <CheckboxPrimitive.Root
      id={cid}
      className={cn(
        "peer grid size-6 shrink-0 place-items-center rounded-md border-2 border-input bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <label htmlFor={cid} className="flex min-h-touch cursor-pointer items-center gap-3">
      {box}
      <span className="text-body md:text-base">{label}</span>
    </label>
  );
}
