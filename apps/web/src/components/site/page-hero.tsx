import type { ReactNode } from "react";

/** Standard page heading block used by content pages. */
export function PageHero({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-10 pb-6 sm:pt-16">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {intro ? <div className="max-w-2xl text-lg text-muted-foreground">{intro}</div> : null}
      {children}
    </div>
  );
}
