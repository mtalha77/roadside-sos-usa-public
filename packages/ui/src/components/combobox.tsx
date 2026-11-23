"use client";

import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { inputClass } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type ComboboxOption = { value: string; label: string; keywords?: string[] };

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  "aria-label"?: string;
};

/** Searchable select (type to filter, arrows to move, Enter to choose). */
export function Combobox({
  options,
  value = null,
  onValueChange,
  placeholder = "Select",
  searchPlaceholder = "Search",
  emptyText = "No results",
  id,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={aria["aria-label"]}
          className={cn(
            inputClass,
            "items-center justify-between gap-2 text-left",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown aria-hidden="true" className="size-5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command label={aria["aria-label"] ?? placeholder}>
          <Command.Input
            placeholder={searchPlaceholder}
            className="min-h-touch w-full border-b bg-transparent px-4 outline-none placeholder:text-muted-foreground"
          />
          <Command.List id={listId} className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="p-4 text-sm text-muted-foreground">{emptyText}</Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={o.value}
                keywords={[o.label, ...(o.keywords ?? [])]}
                onSelect={() => {
                  onValueChange?.(o.value === value ? null : o.value);
                  setOpen(false);
                }}
                className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md px-3 data-[selected=true]:bg-accent"
              >
                <Check
                  aria-hidden="true"
                  className={cn("size-5", o.value === value ? "opacity-100" : "opacity-0")}
                />
                {o.label}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
