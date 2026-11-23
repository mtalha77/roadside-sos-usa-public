"use client";

import { OTPInput as OTPPrimitive, REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "../lib/cn";

export type OTPInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/**
 * 6-digit code entry. Paste works anywhere; `autocomplete="one-time-code"` lets phones fill the
 * SMS code automatically.
 */
export function OTPInput({ length = 6, invalid, ...props }: OTPInputProps) {
  return (
    <OTPPrimitive
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-invalid={invalid || undefined}
      containerClassName="flex items-center gap-2 has-disabled:opacity-50"
      render={({ slots }) => (
        <div className="flex gap-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={cn(
                "relative grid h-14 w-12 place-items-center rounded-lg border border-input bg-surface text-2xl font-semibold tabular-nums transition-colors duration-150",
                slot.isActive && "border-ring outline-2 outline-ring",
                invalid && "border-critical",
              )}
            >
              {slot.char ??
                (slot.hasFakeCaret ? (
                  <span aria-hidden="true" className="h-6 w-px animate-pulse bg-foreground" />
                ) : null)}
            </div>
          ))}
        </div>
      )}
      {...props}
    />
  );
}
