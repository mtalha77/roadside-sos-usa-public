import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const inputClass =
  "flex min-h-touch w-full rounded-lg border border-input bg-surface px-4 text-body text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-critical md:text-base";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-28 py-3", className)} {...props} />;
}
