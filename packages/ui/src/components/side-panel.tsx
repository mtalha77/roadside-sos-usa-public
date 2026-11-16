"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const SidePanel = DialogPrimitive.Root;

/**
 * Full-height sheet on phones, a panel on the right on desktop. Header with a close button, a
 * scrolling body, and an optional footer that stays at the bottom (for the one main action).
 * Focus is trapped while open; Escape and the close button dismiss it.
 */
export function SidePanelContent({
  title,
  description,
  closeLabel,
  header,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  /** Shown above the title (e.g. a logo). */
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-foreground/40" />
      <DialogPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[30rem] md:border-l",
          "animate-slide-up md:animate-none",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {header}
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-xl font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
          </div>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="grid min-h-touch min-w-touch place-items-center rounded-lg hover:bg-accent"
          >
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="border-t bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
