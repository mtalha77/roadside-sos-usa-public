"use client";

import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useEffect } from "react";

export type CommandAction = {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  icon?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
  label?: string;
  placeholder?: string;
  emptyText?: string;
};

/** Cmd+K / Ctrl+K command palette for the admin dashboard. */
export function CommandPalette({
  open,
  onOpenChange,
  actions,
  label = "Command palette",
  placeholder = "Type a command or search",
  emptyText = "No results",
}: CommandPaletteProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const groups = [...new Set(actions.map((a) => a.group))];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-foreground/40" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-scale-in overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <Command label={label}>
            <Command.Input
              autoFocus
              placeholder={placeholder}
              className="min-h-14 w-full border-b bg-transparent px-5 text-lg outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="p-6 text-center text-muted-foreground">
                {emptyText}
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {actions
                    .filter((a) => a.group === group)
                    .map((a) => (
                      <Command.Item
                        key={a.id}
                        value={a.id}
                        keywords={[a.label, ...(a.keywords ?? [])]}
                        onSelect={() => {
                          a.onSelect();
                          onOpenChange(false);
                        }}
                        className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg px-3 data-[selected=true]:bg-accent [&_svg]:size-5"
                      >
                        {a.icon}
                        <span className="flex-1">{a.label}</span>
                        {a.shortcut ? (
                          <kbd className="rounded border px-1.5 text-xs text-muted-foreground">
                            {a.shortcut}
                          </kbd>
                        ) : null}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
