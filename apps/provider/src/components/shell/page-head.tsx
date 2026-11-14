import type { ReactNode } from "react";

/** Standard portal page heading with an optional action on the right. */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export const pageMain = "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 sm:pt-8";
export const card = "rounded-2xl border bg-card p-4 sm:p-5";
