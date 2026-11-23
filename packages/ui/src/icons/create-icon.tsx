import type { ReactNode, SVGProps } from "react";

/** Icon grid: 24x24, 2px stroke, round caps and joins, no fill, currentColor (both themes). */
export const ICON_GRID = { viewBox: "0 0 24 24", strokeWidth: 2 } as const;

export type RsosIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number | string };
export type RsosIcon = ((props: RsosIconProps) => ReactNode) & { displayName: string };

/** Builds an original icon on the shared grid so every icon matches Lucide's stroke style. */
export function createIcon(displayName: string, children: ReactNode): RsosIcon {
  const Icon = ({ size = 24, strokeWidth = ICON_GRID.strokeWidth, ...props }: RsosIconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={ICON_GRID.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}
