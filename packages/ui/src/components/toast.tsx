"use client";

import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";

export { toast };

/**
 * Mount once per app. Toasts are announced politely to screen readers; important errors should
 * also stay visible on the page (an Alert), not only in a toast.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl border bg-popover text-popover-foreground shadow-lg",
          description: "text-muted-foreground",
          error: "border-critical",
          success: "border-success",
        },
      }}
    />
  );
}
