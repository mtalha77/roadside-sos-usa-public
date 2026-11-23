"use client";

import { inputClass } from "@rsos/ui/input";
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";

/**
 * Filters the server-rendered FAQ (every answer stays in the page). Matching is on question and
 * answer text; groups with no match are hidden. Works as plain content without JavaScript.
 */
export function FaqSearch({ label, noResults }: { label: string; noResults: string }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const group of document.querySelectorAll<HTMLElement>("[data-faq-group]")) {
      let visible = 0;
      for (const item of group.querySelectorAll<HTMLElement>("details")) {
        const hit = !q || (item.textContent ?? "").toLowerCase().includes(q);
        item.hidden = !hit;
        if (hit) visible++;
      }
      group.hidden = visible === 0;
      shown += visible;
    }
    // Reflect the result for screen readers (announced below).
    queueMicrotask(() => setEmpty(shown === 0));
  }, [query]);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass + " pl-10"}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground">
        {empty ? noResults.replace("{query}", query) : ""}
      </p>
    </div>
  );
}
