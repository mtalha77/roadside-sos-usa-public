/**
 * Design tokens: the single source of truth for colour, type, space, radius, elevation and motion.
 * "Calm under stress": deep ink neutrals, ONE safety-amber signal colour for the main action and
 * urgency only, status colours for state, generous type. Edit here, then run
 * `pnpm --filter @rsos/config tokens:build` to regenerate tailwind/theme.css. CI checks contrast
 * (scripts/check-contrast.ts) and that the CSS is up to date.
 */

/** Ink: cool, deep neutral scale (hue 262). */
export const ink = {
  50: "oklch(0.985 0.003 262)",
  100: "oklch(0.967 0.005 262)",
  200: "oklch(0.928 0.008 262)",
  300: "oklch(0.87 0.012 262)",
  400: "oklch(0.71 0.018 262)",
  500: "oklch(0.553 0.022 262)",
  600: "oklch(0.446 0.025 262)",
  700: "oklch(0.372 0.025 262)",
  800: "oklch(0.279 0.022 262)",
  850: "oklch(0.235 0.02 262)",
  900: "oklch(0.208 0.018 262)",
  950: "oklch(0.155 0.015 262)",
} as const;

/** Safety amber: the signal colour. Use only for the primary action and urgency. */
export const amber = {
  300: "oklch(0.87 0.13 82)",
  400: "oklch(0.83 0.155 78)",
  500: "oklch(0.785 0.165 72)",
  600: "oklch(0.705 0.165 62)",
  800: "oklch(0.5 0.12 55)",
} as const;

type ThemeTokens = Record<string, string>;

/** Semantic colours per theme. Names follow shadcn/ui so components restyle automatically. */
export const themes: { light: ThemeTokens; dark: ThemeTokens } = {
  light: {
    background: ink[50],
    foreground: ink[950],
    surface: "oklch(1 0 0)",
    "surface-raised": "oklch(1 0 0)",
    card: "oklch(1 0 0)",
    "card-foreground": ink[950],
    popover: "oklch(1 0 0)",
    "popover-foreground": ink[950],
    muted: ink[100],
    "muted-foreground": ink[600],
    border: ink[200],
    input: ink[500],
    ring: "oklch(0.5 0.17 255)",
    // Signal: amber surface, ink text.
    primary: amber[500],
    "primary-foreground": ink[950],
    "primary-hover": amber[600],
    signal: amber[500],
    "signal-foreground": ink[950],
    "signal-strong": amber[800],
    secondary: ink[100],
    "secondary-foreground": ink[900],
    accent: ink[100],
    "accent-foreground": ink[900],
    destructive: "oklch(0.52 0.19 27)",
    "destructive-foreground": "oklch(0.99 0 0)",
    success: "oklch(0.5 0.12 155)",
    "success-foreground": "oklch(0.99 0 0)",
    "success-subtle": "oklch(0.95 0.04 155)",
    "success-strong": "oklch(0.42 0.1 155)",
    warning: "oklch(0.55 0.14 50)",
    "warning-foreground": "oklch(0.99 0 0)",
    "warning-subtle": "oklch(0.95 0.04 60)",
    "warning-strong": "oklch(0.47 0.12 50)",
    critical: "oklch(0.52 0.19 27)",
    "critical-foreground": "oklch(0.99 0 0)",
    "critical-subtle": "oklch(0.95 0.03 27)",
    "critical-strong": "oklch(0.47 0.18 27)",
    info: "oklch(0.5 0.17 255)",
    "info-foreground": "oklch(0.99 0 0)",
    "info-subtle": "oklch(0.95 0.03 255)",
    "info-strong": "oklch(0.45 0.15 255)",
  },
  dark: {
    background: ink[950],
    foreground: ink[50],
    surface: ink[900],
    "surface-raised": ink[850],
    card: ink[900],
    "card-foreground": ink[50],
    popover: ink[850],
    "popover-foreground": ink[50],
    muted: ink[850],
    "muted-foreground": ink[400],
    border: ink[800],
    input: ink[500],
    ring: "oklch(0.72 0.13 255)",
    primary: amber[400],
    "primary-foreground": ink[950],
    "primary-hover": amber[300],
    signal: amber[400],
    "signal-foreground": ink[950],
    "signal-strong": amber[400],
    secondary: ink[800],
    "secondary-foreground": ink[50],
    accent: ink[800],
    "accent-foreground": ink[50],
    destructive: "oklch(0.68 0.17 25)",
    "destructive-foreground": ink[950],
    success: "oklch(0.72 0.14 155)",
    "success-foreground": ink[950],
    "success-subtle": "oklch(0.3 0.05 155)",
    "success-strong": "oklch(0.78 0.13 155)",
    warning: "oklch(0.75 0.13 60)",
    "warning-foreground": ink[950],
    "warning-subtle": "oklch(0.3 0.05 60)",
    "warning-strong": "oklch(0.8 0.12 60)",
    critical: "oklch(0.68 0.17 25)",
    "critical-foreground": ink[950],
    "critical-subtle": "oklch(0.3 0.06 25)",
    "critical-strong": "oklch(0.75 0.15 25)",
    info: "oklch(0.72 0.13 255)",
    "info-foreground": ink[950],
    "info-subtle": "oklch(0.3 0.05 255)",
    "info-strong": "oklch(0.78 0.11 255)",
  },
};

/**
 * Every foreground/background pair the UI uses, with the WCAG 2.2 AA minimum:
 * 4.5 for text, 3 for large text and non-text UI (borders of inputs, focus rings).
 */
export const contrastPairs: { fg: string; bg: string; min: number }[] = [
  { fg: "foreground", bg: "background", min: 4.5 },
  { fg: "foreground", bg: "surface", min: 4.5 },
  { fg: "card-foreground", bg: "card", min: 4.5 },
  { fg: "popover-foreground", bg: "popover", min: 4.5 },
  { fg: "muted-foreground", bg: "background", min: 4.5 },
  { fg: "muted-foreground", bg: "surface", min: 4.5 },
  { fg: "muted-foreground", bg: "muted", min: 4.5 },
  { fg: "primary-foreground", bg: "primary", min: 4.5 },
  { fg: "primary-foreground", bg: "primary-hover", min: 4.5 },
  { fg: "signal-foreground", bg: "signal", min: 4.5 },
  { fg: "signal-strong", bg: "background", min: 4.5 },
  { fg: "signal-strong", bg: "surface", min: 4.5 },
  { fg: "secondary-foreground", bg: "secondary", min: 4.5 },
  { fg: "accent-foreground", bg: "accent", min: 4.5 },
  { fg: "destructive-foreground", bg: "destructive", min: 4.5 },
  ...(["success", "warning", "critical", "info"] as const).flatMap((s) => [
    { fg: `${s}-foreground`, bg: s, min: 4.5 },
    { fg: `${s}-strong`, bg: `${s}-subtle`, min: 4.5 },
    { fg: `${s}-strong`, bg: "background", min: 4.5 },
    { fg: `${s}-strong`, bg: "surface", min: 4.5 },
  ]),
  { fg: "input", bg: "background", min: 3 },
  { fg: "input", bg: "surface", min: 3 },
  { fg: "ring", bg: "background", min: 3 },
  { fg: "ring", bg: "surface", min: 3 },
];

/** Type scale (rem). Body is 17px on phones, 16px from 768px. */
export const typeScale = {
  xs: ["0.8125rem", "1.25rem"],
  sm: ["0.9375rem", "1.375rem"],
  base: ["1rem", "1.5rem"],
  body: ["1.0625rem", "1.625rem"],
  lg: ["1.1875rem", "1.75rem"],
  xl: ["1.375rem", "1.875rem"],
  "2xl": ["1.625rem", "2.125rem"],
  "3xl": ["2rem", "2.5rem"],
  "4xl": ["2.5rem", "2.875rem"],
  "display-sm": ["3rem", "3.25rem"],
  display: ["3.75rem", "4rem"],
  "display-lg": ["4.5rem", "4.75rem"],
} as const;

/** 8-point radius and elevation. */
export const radius = {
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.25rem",
  "2xl": "1.75rem",
} as const;
export const shadows = {
  sm: "0 1px 2px 0 oklch(0.155 0.015 262 / 0.06)",
  md: "0 2px 8px -2px oklch(0.155 0.015 262 / 0.1), 0 1px 2px 0 oklch(0.155 0.015 262 / 0.06)",
  lg: "0 12px 32px -8px oklch(0.155 0.015 262 / 0.18), 0 2px 6px 0 oklch(0.155 0.015 262 / 0.06)",
} as const;

/** Motion: short and purposeful. Durations collapse to near zero with prefers-reduced-motion. */
export const motion = {
  duration: { fast: "150ms", base: "200ms", slow: "250ms" },
  ease: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.05, 0.7, 0.1, 1)",
    exit: "cubic-bezier(0.3, 0, 1, 1)",
  },
} as const;

/** Spacing follows an 8-point rhythm: use Tailwind steps 2, 4, 6, 8, 12, 16 (8px to 64px); 1 and 3 only for fine alignment. */
export const spacingSteps = [2, 4, 6, 8, 12, 16, 20, 24] as const;
