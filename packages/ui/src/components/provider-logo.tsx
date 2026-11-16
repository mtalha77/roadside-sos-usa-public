import { cn } from "../lib/cn";

export type ProviderLogoData = {
  /** One or two letters. */
  monogram: string;
  shape: "circle" | "shield" | "hex" | "square";
  /** Muted logo colour 1 to 8 (`--mark-1` ... `--mark-8` tokens). */
  tone: number;
};

const SHAPES: Record<ProviderLogoData["shape"], string> = {
  circle: "M24 2a22 22 0 1 1 0 44a22 22 0 1 1 0-44z",
  shield: "M24 2l19 6.5v13.2c0 11.4-7.8 20.4-19 24.3C12.8 42.1 5 33.1 5 21.7V8.5z",
  hex: "M24 2l19 11v22L24 46 5 35V13z",
  square: "M12 3h24a9 9 0 0 1 9 9v24a9 9 0 0 1-9 9H12a9 9 0 0 1-9-9V12a9 9 0 0 1 9-9z",
};

/**
 * Original provider logo: a flat emblem in one of the muted logo colours with the company's
 * monogram. Decorative (the name is always shown next to it), so it is hidden from screen readers.
 */
export function ProviderLogo({
  logo,
  size = 48,
  className,
}: {
  logo: ProviderLogoData;
  size?: number;
  className?: string;
}) {
  const tone = Math.min(8, Math.max(1, Math.round(logo.tone)));
  const letters = logo.monogram.slice(0, 2).toUpperCase();
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
    >
      <path d={SHAPES[logo.shape]} fill={`var(--mark-${tone})`} />
      <path
        d={SHAPES[logo.shape]}
        fill="none"
        stroke="var(--mark-foreground)"
        strokeOpacity={0.18}
        strokeWidth={1.5}
        transform="translate(24 24) scale(0.82) translate(-24 -24)"
      />
      <text
        x="24"
        y="24"
        dy="0.35em"
        textAnchor="middle"
        fill="var(--mark-foreground)"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontWeight={650}
        fontSize={letters.length > 1 ? 16 : 20}
        letterSpacing="0.02em"
      >
        {letters}
      </text>
    </svg>
  );
}
