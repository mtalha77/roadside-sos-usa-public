"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const AUTO = "rsos_night_auto";

/**
 * Dark mode by default at night (7 pm to 7 am, local time) unless the provider chose a theme.
 * Switches back in the morning only if it was switched automatically.
 */
export function NightTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    const hour = new Date().getHours();
    const night = hour >= 19 || hour < 7;
    const auto = localStorage.getItem(AUTO) === "1";
    if (night && (theme === "system" || theme === undefined)) {
      localStorage.setItem(AUTO, "1");
      setTheme("dark");
    } else if (!night && auto && theme === "dark") {
      localStorage.removeItem(AUTO);
      setTheme("system");
    }
  }, [theme, setTheme]);
  return null;
}
