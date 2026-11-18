"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads a server page every `seconds` while the tab is visible (Today, Calls). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
