import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type StepperProps = {
  steps: ReactNode[];
  current: number;
  label: string;
  className?: string;
};

/** Progress through a multi-step flow. The current step is marked with aria-current="step". */
export function Stepper({ steps, current, label, className }: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li
              key={i}
              aria-current={state === "current" ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums",
                  state === "done" && "border-success bg-success text-success-foreground",
                  state === "current" && "border-foreground text-foreground",
                  state === "todo" && "border-border text-muted-foreground",
                )}
              >
                {state === "done" ? (
                  <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  state === "todo" ? "text-muted-foreground" : "font-semibold",
                )}
              >
                {step}
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden="true" className="h-0.5 flex-1 rounded-full bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
