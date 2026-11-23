import { cn } from "../lib/cn";

export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "quoting",
  "quoted",
  "accepted",
  "en_route",
  "on_site",
  "completed",
  "cancelled",
  "expired",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const defaultStatusLabels: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Sent",
  quoting: "Getting quotes",
  quoted: "Quotes ready",
  accepted: "Provider confirmed",
  en_route: "On the way",
  on_site: "Arrived",
  completed: "Done",
  cancelled: "Cancelled",
  expired: "Expired",
};

const tone: Record<RequestStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info-subtle text-info-strong",
  quoting: "bg-info-subtle text-info-strong",
  quoted: "bg-signal text-signal-foreground",
  accepted: "bg-success-subtle text-success-strong",
  en_route: "bg-success-subtle text-success-strong",
  on_site: "bg-success text-success-foreground",
  completed: "bg-muted text-foreground",
  cancelled: "bg-critical-subtle text-critical-strong",
  expired: "bg-warning-subtle text-warning-strong",
};

const live = new Set<RequestStatus>(["quoting", "en_route"]);

/** Request state at a glance. Colour is never the only signal: the label always shows. */
export function StatusPill({
  status,
  label,
  className,
}: {
  status: RequestStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
        tone[status],
        className,
      )}
    >
      {live.has(status) ? (
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      ) : null}
      {label ?? defaultStatusLabels[status]}
    </span>
  );
}
