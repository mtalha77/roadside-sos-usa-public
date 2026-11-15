"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Service worker registration with an update prompt, and a connection banner (RSOS-051).
 */
export function AppRuntime({
  offlineLabel,
  updateLabel,
  reloadLabel,
}: {
  offlineLabel: string;
  updateLabel: string;
  reloadLabel: string;
}) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    // Automated browsers skip the worker: on protected previews, the worker's own requests in
    // WebKit don't carry the test bypass and loop on Vercel's protection redirect.
    if (!("serviceWorker" in navigator) || navigator.webdriver) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
          });
        });
      })
      .catch(() => undefined);
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    });
  }, []);
  return (
    <>
      {online ? null : (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[70] bg-warning px-4 py-2 text-center text-sm font-semibold text-warning-foreground"
        >
          {offlineLabel}
        </div>
      )}
      {waiting ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border bg-popover p-3 shadow-lg md:bottom-6"
        >
          <span className="text-sm font-medium">{updateLabel}</span>
          <button
            type="button"
            onClick={() => waiting.postMessage("skip-waiting")}
            className="min-h-touch rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
          >
            {reloadLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}
