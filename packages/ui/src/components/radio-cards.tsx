"use client";

import { RadioGroup } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export type RadioCardOption = {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

export type RadioCardsProps = Omit<ComponentProps<typeof RadioGroup.Root>, "children"> & {
  options: RadioCardOption[];
};

/** Large selectable cards (arrow keys move, Space selects). */
export function RadioCards({ options, className, ...props }: RadioCardsProps) {
  return (
    <RadioGroup.Root className={cn("grid gap-3 sm:grid-cols-2", className)} {...props}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-input data-[disabled]:opacity-50 data-[state=checked]:border-primary"
        >
          {o.icon ? <span aria-hidden="true">{o.icon}</span> : null}
          <span className="flex flex-col gap-1">
            <span className="font-semibold">{o.title}</span>
            {o.description ? (
              <span className="text-sm text-muted-foreground">{o.description}</span>
            ) : null}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
