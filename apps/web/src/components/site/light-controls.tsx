"use client";

/**
 * Tiny client controls for the public website. The shared `Button` and `Switch` pull in class
 * merging, cva and Radix, which costs every visitor ~20 KB of JavaScript (RSOS-033 budget). These
 * keep the same look (design tokens, 48px targets, focus ring) with plain elements.
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";

const base =
  "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 font-semibold whitespace-nowrap transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-50";

export const lightButton = {
  outline: `${base} border border-input bg-surface text-foreground hover:bg-accent hover:text-accent-foreground`,
  ghost: `${base} text-foreground hover:bg-accent hover:text-accent-foreground`,
};

export function LightButton({
  variant = "outline",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof lightButton }) {
  return <button type="button" className={`${lightButton[variant]} ${className}`} {...props} />;
}

/** On/off switch (native checkbox with role="switch": keyboard, labels and forms work as usual). */
export function LightSwitch({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={`relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-input transition-colors duration-200 ease-standard before:absolute before:top-0.5 before:left-0.5 before:size-7 before:rounded-full before:bg-surface before:shadow-md before:transition-transform before:duration-200 checked:bg-success checked:before:translate-x-6 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}

/** Light and dark mode switch; icons swap with CSS so server and client markup match. */
export function LightThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`${lightButton.ghost} min-w-touch px-0 [&_svg]:size-5`}
    >
      <Sun aria-hidden="true" className="hidden dark:block" />
      <Moon aria-hidden="true" className="block dark:hidden" />
    </button>
  );
}
