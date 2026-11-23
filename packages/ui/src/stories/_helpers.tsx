import type { ReactNode } from "react";

/** Lays out the states of a component side by side in a story. */
export function States({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 p-6">{children}</div>;
}

export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}
