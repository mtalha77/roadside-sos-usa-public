"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useState } from "react";

/** Dispute a fee (demo: recorded on the page; the disputes queue arrives with the finance tickets). */
export function DisputeButton({ label, sent }: { label: string; sent: string }) {
  const [done, setDone] = useState(false);
  return done ? (
    <Alert tone="success" title={sent} className="mt-4" />
  ) : (
    <Button type="button" variant="outline" className="mt-4" onClick={() => setDone(true)}>
      {label}
    </Button>
  );
}
