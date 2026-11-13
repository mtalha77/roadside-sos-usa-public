"use client";

import { type ComponentProps, useState } from "react";
import { cn } from "../lib/cn";
import { formatCents, parseCents } from "../lib/format";
import { inputClass } from "./input";

export type CurrencyInputProps = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  /** Whole cents (integer), as stored. */
  value?: number | null;
  onValueChange?: (cents: number | null) => void;
};

/** USD amount; shows "$ 1,234.50", stores whole cents. Formats on blur. */
export function CurrencyInput({
  value = null,
  onValueChange,
  className,
  onBlur,
  ...props
}: CurrencyInputProps) {
  const [text, setText] = useState(() => formatCents(value));
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
      >
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.,]/g, "");
          setText(cleaned);
          onValueChange?.(parseCents(cleaned));
        }}
        onBlur={(e) => {
          setText(formatCents(parseCents(text)));
          onBlur?.(e);
        }}
        className={cn(inputClass, "pl-9 text-right tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
