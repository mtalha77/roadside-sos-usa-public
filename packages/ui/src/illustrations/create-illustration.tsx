import type { ReactNode, SVGProps } from "react";

/** Illustration grid: 160x120, 2px stroke, round joins, token colours only (both themes). */
export type IllustrationProps = Omit<SVGProps<SVGSVGElement>, "children"> & { width?: number };
export type Illustration = ((props: IllustrationProps) => ReactNode) & { displayName: string };

export function createIllustration(displayName: string, children: ReactNode): Illustration {
  const Art = ({ width = 160, ...props }: IllustrationProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={(width * 120) / 160}
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="80" cy="108" rx="56" ry="5" fill="var(--muted)" stroke="none" />
      {children}
    </svg>
  );
  Art.displayName = displayName;
  return Art;
}

/** Soft surface fill for shapes (theme-aware). */
export const surface = { fill: "var(--surface)" } as const;
export const muted = { fill: "var(--muted)" } as const;
