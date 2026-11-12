"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./button";

export type ThemeToggleProps = {
  /** Accessible name, passed in already translated. */
  label: string;
};

/**
 * Icons swap with CSS (`dark:` variant), so server and client render the same markup
 * and there is no hydration mismatch.
 */
export function ThemeToggle({ label }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden="true" className="hidden dark:block" />
      <Moon aria-hidden="true" className="block dark:hidden" />
    </Button>
  );
}
