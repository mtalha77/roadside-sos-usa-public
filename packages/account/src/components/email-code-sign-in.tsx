"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  checkEmailCodeAction,
  type EmailSignInState,
  sendEmailCodeAction,
} from "../server/email-sign-in";

/** Sign in with a 6-digit code emailed to the account's address (Supabase Auth email OTP). */
export function EmailCodeSignIn() {
  const t = useTranslations("auth.emailCode");
  const [sent, send, sending] = useActionState<EmailSignInState, FormData>(sendEmailCodeAction, {});
  const [checked, check, checking] = useActionState<EmailSignInState, FormData>(
    checkEmailCodeAction,
    {},
  );
  const error = checked.error ?? sent.error;
  if (!sent.email)
    return (
      <form action={send} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="critical" title={t(`errors.${error}`)} /> : null}
        <Field label={t("email")} description={t("emailHint")}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          )}
        </Field>
        <Button type="submit" loading={sending} className="w-full">
          {t("send")}
        </Button>
      </form>
    );
  return (
    <form action={check} className="flex flex-col gap-4" noValidate>
      <Alert tone="success" title={t("sent")} />
      {sent.demoCode ? (
        <p className="rounded-lg border border-dashed p-3 text-sm">
          {t("demoCode", { code: sent.demoCode })}
        </p>
      ) : null}
      {checked.error ? <Alert tone="critical" title={t(`errors.${checked.error}`)} /> : null}
      <input type="hidden" name="email" value={sent.email} />
      <Field label={t("code")}>
        {({ id }) => (
          <Input
            id={id}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
          />
        )}
      </Field>
      <Button type="submit" loading={checking} className="w-full">
        {t("verify")}
      </Button>
    </form>
  );
}
