"use client";

import { Check } from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 animate-fade-in rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}
const itemClass =
  "relative flex min-h-touch cursor-pointer items-center gap-3 rounded-md px-3 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent [&_svg]:size-5";

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: ComponentProps<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(itemClass, destructive && "text-critical-strong", className)}
      {...props}
    />
  );
}
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem className={cn(itemClass, "pl-10", className)} {...props}>
      <Menu.ItemIndicator className="absolute left-3">
        <Check aria-hidden="true" />
      </Menu.ItemIndicator>
      {children}
    </Menu.CheckboxItem>
  );
}
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return (
    <Menu.Label
      className={cn("px-3 py-2 text-sm font-semibold text-muted-foreground", className)}
      {...props}
    />
  );
}
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}
