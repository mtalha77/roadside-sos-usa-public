"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type ActionState, forgotPasswordAction, resetPasswordAction } from "../server/actions";

/** Same answer whether or not the account exists. */
export function ForgotPasswordForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, {});
  if (state.ok) return <Alert tone="success" title={t("resetSent")} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p>{t("forgotBody")}</p>
      {state.error ? <Alert tone="critical" title={t("emailRequired")} /> : null}
      <Field label={t("email")}>
        {({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {t("sendReset")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ signInHref }: { signInHref: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPasswordAction, {});
  if (state.ok)
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title={t("resetDone")} />
        <Button asChild>
          <a href={signInHref}>{t("toSignIn")}</a>
        </Button>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="critical" title={t("passwordRule")} /> : null}
      <Field label={t("newPassword")}>
        {({ id }) => (
          <Input
            id={id}
            name="next"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        )}
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        {t("resetTitle")}
      </Button>
    </form>
  );
}
