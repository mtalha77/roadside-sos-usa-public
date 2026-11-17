"use client";

import { type ComponentProps, type ComponentType, useRef, useState } from "react";
import type { AddressAutocomplete } from "./address-autocomplete";

type Props = ComponentProps<typeof AddressAutocomplete>;

/**
 * The address field starts as a plain input; the suggestions code loads when the driver starts
 * typing, so it costs nothing on page load (the website's 150 KB JavaScript budget). The full
 * combobox then takes over with the typed text and the focus.
 */
export function AddressField(props: Props) {
  const [Full, setFull] = useState<ComponentType<Props> | null>(null);
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
        if (!loading.current) {
          loading.current = true;
          void import("./address-autocomplete").then((m) => setFull(() => m.AddressAutocomplete));
        }
      }}
    />
  );
}
