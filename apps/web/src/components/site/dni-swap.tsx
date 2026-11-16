"use client";

import { useEffect } from "react";

const SOURCE_COOKIE = "rsos_src";

const format = (e164: string) => {
  const d = e164.replace(/\D/g, "").slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/**
 * Dynamic number insertion (RSOS-030): visitors who arrived from an ad or campaign (first-touch
 * cookie set by the proxy) see that source's tracking number in every tap-to-call link marked
 * `data-dni="<market slug>"`. Everyone else keeps the website number, with no request at all.
 */
export function DniSwap() {
  useEffect(() => {
    const source = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SOURCE_COOKIE}=`))
      ?.split("=")[1];
    if (!source || source === "website") return;
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[data-dni]")];
    for (const market of new Set(links.map((a) => a.dataset.dni ?? ""))) {
      if (!market) continue;
      fetch(`/api/phone?market=${encodeURIComponent(market)}&source=${encodeURIComponent(source)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { phone?: unknown } | null) => {
          const phone = typeof d?.phone === "string" ? d.phone : null;
          if (!phone || !/^\+1\d{10}$/.test(phone)) return;
          for (const a of links.filter((l) => l.dataset.dni === market)) {
            const old = format(a.href.replace(/^tel:/, ""));
            a.href = `tel:${phone}`;
            const label = a.getAttribute("aria-label");
            if (label) a.setAttribute("aria-label", label.replace(old, format(phone)));
            const text = a.hasAttribute("data-dni-text")
              ? a
              : a.querySelector<HTMLElement>("[data-dni-text]");
            if (text) text.textContent = format(phone);
          }
        })
        .catch(() => undefined);
    }
  }, []);
  return null;
}
