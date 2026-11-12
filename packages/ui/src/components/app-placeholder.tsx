import { brand } from "@rsos/config/brand";
import { Button } from "./button";
import { ThemeToggle } from "./theme-toggle";

export type AppPlaceholderProps = {
  /** Which app this is, e.g. "Provider portal" (translated). */
  appLabel: string;
  headline: string;
  body: string;
  cta: string;
  comingSoon: string;
  toggleThemeLabel: string;
  skipToContentLabel: string;
};

/** Temporary landing page shared by all three apps until real pages exist. */
export function AppPlaceholder({
  appLabel,
  headline,
  body,
  cta,
  comingSoon,
  toggleThemeLabel,
  skipToContentLabel,
}: AppPlaceholderProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-3"
      >
        {skipToContentLabel}
      </a>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <p className="text-lg font-bold">
            <span className="sm:hidden">{brand.shortName}</span>
            <span className="hidden sm:inline">{brand.name}</span>
          </p>
          <ThemeToggle label={toggleThemeLabel} />
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6"
      >
        <p className="w-fit rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
          {appLabel}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {brand.name}
        </h1>
        <p className="text-2xl font-semibold text-balance">{headline}</p>
        <p className="max-w-prose text-lg text-muted-foreground">{body}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" disabled aria-describedby="coming-soon">
            {cta}
          </Button>
          <span id="coming-soon" className="text-sm text-muted-foreground">
            {comingSoon}
          </span>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {brand.name} · {brand.domain}
        </div>
      </footer>
    </div>
  );
}
