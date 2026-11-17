"use client";

import { type ComponentProps, type ComponentType, useRef, useState } from "react";
import type { AddressAutocomplete } from "./address-autocomplete";

type Props = ComponentProps<typeof AddressAutocomplete> & {
  /** Suggestions only when Google Maps is switched on; otherwise a plain typed address. */
  suggest: boolean;
};

/**
 * The address field is a plain typed address (no autocomplete while Google Maps is off). With
 * Maps switched on, the suggestions code loads when the driver starts typing, so it costs nothing
 * on page load (the website's 150 KB JavaScript budget), and the combobox takes over.
 */
export function AddressField({ suggest, ...props }: Props) {
  const [Full, setFull] = useState<ComponentType<
    ComponentProps<typeof AddressAutocomplete>
  > | null>(null);
  const [value, setValue] = useState(props.defaultValue);
  const loading = useRef(false);
  if (Full) return <Full {...props} defaultValue={value} autoFocus />;
  return (
    <input
      id={props.id}
      name={props.name}
      defaultValue={props.defaultValue}
      autoComplete={props.autoComplete}
      className={props.className}
      onChange={(e) => {
        setValue(e.target.value);
        if (suggest && !loading.current) {
          loading.current = true;
          void import("./address-autocomplete").then((m) => setFull(() => m.AddressAutocomplete));
        }
      }}
    />
  );
}
