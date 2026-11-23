import { Clock } from "lucide-react";
import { cn } from "../lib/cn";

export type EtaChipProps = {
  minutes: number;
  /** Format the label, e.g. (m) => `${m} min`. Pass a translated formatter. */
  format?: (minutes: number) => string;
  /** Accessible sentence, e.g. "Arrives in about 12 minutes". */
  srLabel?: (minutes: number) => string;
  className?: string;
};

export function EtaChip({
  minutes,
  format = (m) => `${m} min`,
  srLabel = (m) => `Arrives in about ${m} minutes`,
  className,
}: EtaChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums",
        className,
      )}
    >
      <Clock aria-hidden="true" className="size-4" />
      <span aria-hidden="true">{format(minutes)}</span>
      <span className="sr-only">{srLabel(minutes)}</span>
    </span>
  );
}
