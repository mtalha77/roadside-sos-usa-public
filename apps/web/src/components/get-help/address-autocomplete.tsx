"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

type Suggestion = { placeId: string; text: string; secondary: string };

/**
 * Address field with Places suggestions (RSOS-021b): an ARIA combobox (arrow keys, Enter, Escape),
 * biased to the city picked in the same form. Picking a suggestion stores its place id in a hidden
 * field so the server can look up the exact point. Without JavaScript it is a plain text field.
 */
export function AddressAutocomplete({
  id,
  name,
  defaultValue,
  className,
  listLabel,
  autoComplete,
  autoFocus,
}: {
  id: string;
  name: string;
  defaultValue: string;
  className: string;
  listLabel: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [placeId, setPlaceId] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // One Places session per typing session (billing groups autocomplete with the final lookup).
  const session = useRef<string>("");

  // Leaving the page (submitting the form) cancels any lookup in flight, so the browser does not
  // report a cancelled request as an error.
  const inflight = useRef<AbortController | null>(null);
  useEffect(() => {
    const stop = () => inflight.current?.abort();
    const form = input.current?.form;
    form?.addEventListener("submit", stop);
    window.addEventListener("pagehide", stop);
    return () => {
      form?.removeEventListener("submit", stop);
      window.removeEventListener("pagehide", stop);
    };
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (placeId || q.length < 3) return;
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const timer = setTimeout(async () => {
      session.current ||= crypto.randomUUID();
      const market = (input.current?.form?.elements.namedItem("market") as HTMLSelectElement | null)
        ?.value;
      const params = new URLSearchParams({ q, session: session.current });
      if (market) params.set("market", market);
      try {
        if (ctrl.signal.aborted) return;
        const res = await fetch(`/api/places?${params}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        setItems(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        // Offline or aborted: the field still works as plain text.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, placeId]);

  const pick = (s: Suggestion) => {
    setValue(s.secondary ? `${s.text}, ${s.secondary}` : s.text);
    setPlaceId(s.placeId);
    setOpen(false);
    session.current = "";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={input}
        id={id}
        name={name}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setPlaceId("");
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={className}
      />
      <input type="hidden" name="placeId" value={placeId} />
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground"
      >
        {items.map((s, i) => (
          <li
            key={s.placeId}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(s);
            }}
            className="flex min-h-touch cursor-pointer flex-col justify-center px-4 py-2 aria-selected:bg-accent hover:bg-accent"
          >
            <span className="font-medium">{s.text}</span>
            {s.secondary ? (
              <span className="text-sm text-muted-foreground">{s.secondary}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
