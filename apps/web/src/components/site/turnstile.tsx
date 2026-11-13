"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile. Loaded after the page is interactive (never blocks first paint); it adds
 * a hidden `cf-turnstile-response` field to the surrounding form. Test keys pass automatically.
 */
export function Turnstile({
  siteKey,
  label,
  theme = "auto",
}: {
  siteKey: string;
  label: string;
  theme?: "auto" | "light" | "dark";
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, { sitekey: siteKey, theme, size: "flexible" });
    };
    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, theme]);
  return <div ref={box} role="group" aria-label={label} className="min-h-[65px]" />;
}
