/**
 * Class strings for plain elements on the public website, matching the shared components' look
 * (design tokens, 48px targets) without shipping their JavaScript (RSOS-033 budget).
 */
const button =
  "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 font-semibold whitespace-nowrap transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50";

export const ui = {
  button: {
    primary: `${button} bg-primary text-primary-foreground hover:bg-primary-hover`,
    outline: `${button} border border-input bg-surface text-foreground hover:bg-accent hover:text-accent-foreground`,
    ghost: `${button} text-foreground hover:bg-accent hover:text-accent-foreground`,
  },
  /** Native checkbox drawn as a switch; use with role="switch". */
  switch:
    "relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-input transition-colors duration-200 ease-standard before:absolute before:top-0.5 before:left-0.5 before:size-7 before:rounded-full before:bg-surface before:shadow-md before:transition-transform before:duration-200 checked:bg-success checked:before:translate-x-6 disabled:cursor-not-allowed disabled:opacity-60",
};
