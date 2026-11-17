"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import {
  checkSignInCodeAction,
  sendSignInCodeAction,
  type SmsSignInState,
} from "../server/sms-sign-in";

/** Sign in with a code texted to the account's mobile number (RSOS-021b, Twilio Verify). */
export function SmsSignIn() {
  const t = useTranslations("auth.sms");
  const [sent, send, sending] = useActionState<SmsSignInState, FormData>(sendSignInCodeAction, {});
  const [checked, check, checking] = useActionState<SmsSignInState, FormData>(
    checkSignInCodeAction,
    {},
  );
  const error = checked.error ?? sent.error;
  if (!sent.phone)
    return (
      <form action={send} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="critical" title={t(`errors.${error}`)} /> : null}
        <Field label={t("phone")} description={t("phoneHint")}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
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
      <input type="hidden" name="phone" value={sent.phone} />
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
