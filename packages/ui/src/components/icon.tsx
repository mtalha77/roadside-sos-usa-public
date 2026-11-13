import type { LucideIcon } from "lucide-react";
import type { RsosIcon } from "../icons/create-icon";
import { cn } from "../lib/cn";

export { serviceIcons, type ServiceIconKey } from "../icons/service-icons";
export { vehicleIcons, type VehicleIconKey } from "../icons/vehicle-icons";

const sizes = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

export type IconProps = {
  /** A Lucide icon or one of our original icons (same grid and stroke). */
  icon: LucideIcon | RsosIcon;
  size?: keyof typeof sizes;
  /** Give a label only when the icon carries meaning on its own; otherwise it is hidden from screen readers. */
  label?: string;
  className?: string;
};

/** The one way to render an icon: consistent sizes, 2px stroke, currentColor, correct a11y. */
export function Icon({ icon: Glyph, size = "md", label, className }: IconProps) {
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };
  return (
    <Glyph size={sizes[size]} strokeWidth={2} className={cn("shrink-0", className)} {...a11y} />
  );
}
