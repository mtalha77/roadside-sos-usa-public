"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { OTPInput } from "@rsos/ui/otp-input";
import { PhoneInput } from "@rsos/ui/phone-input";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { type AuthFormState, checkPhoneCodeAction, sendPhoneCodeAction } from "@/lib/auth-actions";

export function PhoneVerification() {
  const t = useTranslations("auth");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sent, sendAction, sending] = useActionState<AuthFormState, FormData>(
    sendPhoneCodeAction,
    {},
  );
  const [checked, checkAction, checking] = useActionState<AuthFormState, FormData>(
    checkPhoneCodeAction,
    {},
  );
  if (sent.unavailable) return <Alert tone="warning" title={t("provider.smsUnavailable")} />;
  if (!sent.codeSent) {
    return (
      <form action={sendAction} className="flex flex-col gap-4">
        <input type="hidden" name="phone" value={phone ?? ""} />
        {sent.error ? <Alert tone="critical" title={t(`errors.${sent.error}`)} /> : null}
        <Field label={t("provider.phone")}>
          {({ id }) => <PhoneInput id={id} onValueChange={setPhone} />}
        </Field>
        <Button type="submit" loading={sending} disabled={!phone} className="w-full">
          {t("provider.sendCode")}
        </Button>
      </form>
    );
  }
  return (
    <form action={checkAction} className="flex flex-col gap-4">
      <input type="hidden" name="phone" value={sent.codeSent} />
      <input type="hidden" name="code" value={code} />
      <p aria-live="polite">{t("provider.codeSent", { phone: sent.codeSent })}</p>
      {sent.mock ? (
        <Alert tone="info" title={t("provider.mockNotice", { code: sent.mock })} />
      ) : null}
      {checked.error ? <Alert tone="critical" title={t(`errors.${checked.error}`)} /> : null}
      <OTPInput
        aria-label={t("code")}
        value={code}
        onChange={setCode}
        invalid={Boolean(checked.error)}
      />
      <Button type="submit" loading={checking} disabled={code.length !== 6} className="w-full">
        {t("verify")}
      </Button>
    </form>
  );
}
