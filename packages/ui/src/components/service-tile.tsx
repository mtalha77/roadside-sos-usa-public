import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export type ServiceTileProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  hint?: string;
  selected?: boolean;
};

/** Large tap target for choosing a service (whole tile is the button). */
export function ServiceTile({
  icon,
  label,
  hint,
  selected = false,
  className,
  ...props
}: ServiceTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "group flex min-h-28 w-full cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 border-border bg-surface p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-input hover:shadow-md active:scale-[0.98] aria-pressed:border-primary aria-pressed:shadow-md disabled:pointer-events-none disabled:opacity-50 sm:p-5",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-xl bg-muted text-foreground transition-colors duration-150 group-aria-pressed:bg-primary group-aria-pressed:text-primary-foreground [&_svg]:size-7"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-lg leading-tight font-semibold">{label}</span>
        {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}
