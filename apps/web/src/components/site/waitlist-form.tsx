"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { joinWaitlistAction, type WaitlistState } from "@/lib/actions";

/** "Not in your area yet": email (and optional ZIP) saved to the waitlist. */
export function WaitlistForm({ city, region }: { city: string | null; region: string | null }) {
  const t = useTranslations("site.market");
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlistAction, {});
  if (state.ok) return <Alert tone="success" title={t("joined")} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      {city ? <input type="hidden" name="city" value={city} /> : null}
      {region ? <input type="hidden" name="region" value={region} /> : null}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label={t("email")}>
          {({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field label={t("zip")}>
          {({ id }) => (
            <Input
              id={id}
              name="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              pattern="[0-9]{5}"
            />
          )}
        </Field>
      </div>
      <Button type="submit" loading={pending} className="self-start">
        {t("join")}
      </Button>
    </form>
  );
}
