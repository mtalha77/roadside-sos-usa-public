"use client";

import { Button } from "@rsos/ui/button";
import { Phone } from "lucide-react";
import { DIAL_EVENT, type DialRequest } from "./softphone-dock";

/** "Call" from any screen: hands the number to the softphone dock (RSOS-074b). */
export function CallButton({ label, call }: { label: string; call: DialRequest }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        window.dispatchEvent(new CustomEvent<DialRequest>(DIAL_EVENT, { detail: call }))
      }
    >
      <Phone aria-hidden="true" />
      {label}
    </Button>
  );
}
