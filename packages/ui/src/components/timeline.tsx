import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  time: ReactNode;
  /** Machine-readable time for <time>. */
  dateTime?: string;
  description?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "critical" | "info";
};

const dot = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-critical",
  info: "bg-info",
};

/** Ordered event history (request events, audit log). Newest first by convention. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col gap-6 border-l-2 pl-6", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 -left-[2.0625rem] size-3.5 rounded-full ring-4 ring-background",
              dot[item.tone ?? "neutral"],
            )}
          />
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            <time dateTime={item.dateTime}>{item.time}</time>
          </p>
          {item.description ? <div className="mt-1 text-sm">{item.description}</div> : null}
        </li>
      ))}
    </ol>
  );
}
