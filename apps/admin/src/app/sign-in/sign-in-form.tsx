"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type AuthFormState, signInAction } from "@/lib/auth-actions";

export function SignInForm({ expired }: { expired: boolean }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {expired && !state.error ? <Alert tone="info" title={t("errors.expired")} /> : null}
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      <Field label={t("email")}>
        {({ id }) => <Input id={id} name="email" type="email" autoComplete="username" required />}
      </Field>
      <Field label={t("password")}>
        {({ id }) => (
          <Input id={id} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {t("continue")}
      </Button>
    </form>
  );
}
