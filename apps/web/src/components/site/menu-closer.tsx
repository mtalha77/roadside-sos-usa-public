"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The header menus are native <details> disclosures. This closes them after navigation, on Escape
 * (returning focus to the menu button) and on a click outside, and keeps only one open at a time.
 */
export function MenuCloser() {
  const pathname = usePathname();
  useEffect(() => {
    for (const d of document.querySelectorAll<HTMLDetailsElement>("details[data-menu]"))
      d.open = false;
  }, [pathname]);
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>("details[data-menu]")];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const d of menus())
        if (d.open) {
          d.open = false;
          d.querySelector("summary")?.focus();
        }
    };
    const onClick = (e: MouseEvent) => {
      for (const d of menus()) if (d.open && !d.contains(e.target as Node)) d.open = false;
    };
    const onToggle = (e: Event) => {
      const t = e.target as HTMLDetailsElement;
      if (t.matches?.("details[data-menu]") && t.open)
        for (const d of menus()) if (d !== t) d.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
