"use client";

import { useEffect } from "react";

/**
 * Where people drop (RSOS-111): remembers the last form field the visitor touched on this Get Help
 * screen and, if they leave without sending the form, tells the server which screen and field.
 * Only the field's name is sent, never what was typed.
 */
export function FunnelBeacon({ step }: { step: string }) {
  useEffect(() => {
    let field: string | null = null;
    let sending = false;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      const name = el?.getAttribute("name") ?? el?.getAttribute("id");
      if (el?.closest("main form") && name && /^[A-Za-z]{1,40}$/.test(name)) field = name;
    };
    const onSubmit = () => {
      sending = true;
    };
    const onHide = () => {
      if (sending || !navigator.sendBeacon) return;
      const body = new FormData();
      body.set("event", "left");
      body.set("step", step);
      if (field) body.set("field", field);
      navigator.sendBeacon("/api/funnel", body);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pagehide", onHide);
    };
  }, [step]);
  return null;
}
