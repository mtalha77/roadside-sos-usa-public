"use client";

import { type ComponentProps, useState } from "react";
import { cn } from "../lib/cn";
import { formatUsPhone, toE164 } from "../lib/format";
import { inputClass } from "./input";

export type PhoneInputProps = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  /** E.164 value, e.g. "+15125550123". */
  value?: string | null;
  /** Called with E.164 when the number is complete, null otherwise. */
  onValueChange?: (e164: string | null) => void;
};

/** US phone number with "(512) 555-0123" formatting; emits E.164. */
export function PhoneInput({ value, onValueChange, className, ...props }: PhoneInputProps) {
  const [display, setDisplay] = useState(() => formatUsPhone(value ?? ""));
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
      >
        +1
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(555) 555-0123"
        value={display}
        onChange={(e) => {
          const next = formatUsPhone(e.target.value);
          setDisplay(next);
          onValueChange?.(toE164(next));
        }}
        className={cn(inputClass, "pl-12 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}
