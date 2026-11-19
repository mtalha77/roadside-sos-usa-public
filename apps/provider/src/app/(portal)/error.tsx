"use client";

import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";

/** A page that failed to load (RSOS-103): say so plainly and offer a retry; the shell stays. */
export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("portal.states");
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("errorTitle")}</h1>
      <p role="alert" className="text-muted-foreground">
        {t("errorBody")}
      </p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
