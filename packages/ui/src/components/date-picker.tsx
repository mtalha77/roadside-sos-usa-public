"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { cn } from "../lib/cn";
import { inputClass } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type DatePickerProps = {
  value?: Date | null;
  onValueChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: Matcher | Matcher[];
  id?: string;
  "aria-label"?: string;
};

/** Date field with a keyboard-accessible calendar (arrows move days, Enter selects). */
export function DatePicker({
  value = null,
  onValueChange,
  placeholder = "Pick a date",
  disabled,
  id,
  ...aria
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={aria["aria-label"]}
          className={cn(
            inputClass,
            "items-center gap-3 text-left",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarDays aria-hidden="true" className="size-5" />
          {value ? format(value, "PPP") : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <DayPicker
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onValueChange?.(d ?? null);
            setOpen(false);
          }}
          disabled={disabled}
          autoFocus
          classNames={{
            months: "flex flex-col",
            month_caption: "flex h-10 items-center justify-center font-semibold",
            nav: "absolute inset-x-3 top-3 flex justify-between",
            button_previous: "grid size-10 place-items-center rounded-md hover:bg-accent",
            button_next: "grid size-10 place-items-center rounded-md hover:bg-accent",
            weekday: "w-11 text-sm font-medium text-muted-foreground",
            day: "p-0",
            day_button: "grid size-11 place-items-center rounded-md tabular-nums hover:bg-accent",
            selected: "[&>button]:bg-primary [&>button]:text-primary-foreground",
            today: "[&>button]:font-bold [&>button]:underline",
            disabled: "opacity-40",
            outside: "text-muted-foreground",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
