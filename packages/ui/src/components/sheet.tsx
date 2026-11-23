"use client";

import type { ComponentProps, ReactNode } from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "../lib/cn";

export const Sheet = Vaul.Root;
export const SheetTrigger = Vaul.Trigger;
export const SheetClose = Vaul.Close;

export type SheetContentProps = ComponentProps<typeof Vaul.Content> & {
  title: ReactNode;
  description?: ReactNode;
};

/**
 * Bottom sheet for phones (and a centered sheet on desktop). Drag or swipe down to close;
 * Escape closes; focus is trapped while open.
 */
export function SheetContent({
  title,
  description,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <Vaul.Portal>
      <Vaul.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      <Vaul.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-3xl border bg-popover text-popover-foreground shadow-lg outline-none",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/40"
        />
        <div className="flex flex-col gap-1 px-5 pt-4">
          <Vaul.Title className="text-xl font-semibold">{title}</Vaul.Title>
          {description ? (
            <Vaul.Description className="text-muted-foreground">{description}</Vaul.Description>
          ) : null}
        </div>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </Vaul.Content>
    </Vaul.Portal>
  );
}
