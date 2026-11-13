"use client";

import { useEffect } from "react";

// RSOS-096 gate proof (throwaway, never merged): a console error and an unlabeled button.
export function GateProof() {
  useEffect(() => {
    console.error("RSOS-096 gate proof: deliberate console error");
  }, []);
  return <button type="button" className="size-12" />;
}
