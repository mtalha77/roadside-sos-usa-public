"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { NIGHT_AUTO_KEY } from "./night-theme";

/**
 * Day or night switch for the portal. A manual choice is kept and turns off the automatic night
 * mode, so the portal never switches back on its own. Icons swap with CSS (no hydration mismatch).
 */
export function ThemeSwitch({ label, className }: { label: string; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.removeItem(NIGHT_AUTO_KEY);
        } catch {
          // Storage unavailable: the theme still changes for this visit.
        }
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
      className={className}
    >
      <Sun aria-hidden="true" className="hidden size-5 text-muted-foreground dark:block" />
      <Moon aria-hidden="true" className="block size-5 text-muted-foreground dark:hidden" />
      {label}
    </button>
  );
}
