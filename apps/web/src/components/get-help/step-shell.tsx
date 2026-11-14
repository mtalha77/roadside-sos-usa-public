import { Alert } from "@rsos/ui/alert";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

/** One question per screen: progress bar, back link, the question and any error. */
export async function StepShell({
  n,
  total,
  title,
  back,
  error,
  children,
}: {
  n: number;
  total: number;
  title: string;
  back: string | null;
  error?: string | null;
  children: ReactNode;
}) {
  const t = await getTranslations("getHelp");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-4 pb-10">
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            href={back}
            className="inline-flex min-h-touch items-center font-medium underline-offset-4 hover:underline"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mr-1"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {t("back")}
          </Link>
        ) : null}
        <p className="ml-auto text-sm text-muted-foreground tabular-nums">
          {t("progress", { n, total })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={t("progress", { n, total })}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={n}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${(n / total) * 100}%` }}
        />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {error ? <Alert tone="critical" title={t(`errors.${error}` as never)} /> : null}
      {children}
    </div>
  );
}
