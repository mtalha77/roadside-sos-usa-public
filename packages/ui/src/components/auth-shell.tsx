import { brand } from "@rsos/config/brand";
import type { ReactNode } from "react";

export type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered, calm layout for sign-in and verification screens. The brand name is the page heading. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-center text-lg font-semibold text-muted-foreground">{brand.name}</h1>
        <section
          aria-labelledby="auth-title"
          className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="flex flex-col gap-1">
            <h2 id="auth-title" className="text-2xl font-semibold">
              {title}
            </h2>
            {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </section>
        {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
