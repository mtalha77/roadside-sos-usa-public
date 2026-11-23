"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Checkbox } from "@rsos/ui/checkbox";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  type ActionState,
  sendSecondStepCodeAction,
  useRecoveryCodeAction,
  verifySecondStepAction,
  verifyTotpSecondStepAction,
} from "../server/actions";

/** Provider second step: emailed code (sent on arrival) or authenticator app, plus recovery codes. */
export function SecondStepForm({
  email,
  method,
  next,
}: {
  email: string;
  method: "email" | "totp";
  next: string;
}) {
  const t = useTranslations("account");
  const [sent, setSent] = useState<ActionState>({});
  const [sending, startSending] = useTransition();
  const [verify, verifyAction, verifying] = useActionState<ActionState, FormData>(
    method === "totp" ? verifyTotpSecondStepAction : verifySecondStepAction,
    {},
  );
  const [recovery, recoveryAction, recovering] = useActionState<ActionState, FormData>(
    useRecoveryCodeAction,
    {},
  );
  const [showRecovery, setShowRecovery] = useState(false);
  const asked = useRef(false);

  const send = () => startSending(async () => setSent(await sendSecondStepCodeAction()));
  useEffect(() => {
    if (method !== "email" || asked.current) return;
    asked.current = true;
    startSending(async () => setSent(await sendSecondStepCodeAction()));
  }, [method]);

  const error = verify.error ?? sent.error;
  return (
    <div className="flex flex-col gap-6">
      {method === "email" ? (
        <p>{t("secondStepEmailBody", { email })}</p>
      ) : (
        <p>{t("secondStepTotpHint")}</p>
      )}
      {sent.mockCode ? <Alert tone="info" title={t("mockCode", { code: sent.mockCode })} /> : null}
      {error ? (
        <Alert
          tone="critical"

          title={
            error === "locked"
              ? t("locked")
              : error === "expired"
                ? t("expiredCode")
                : t("codeWrong")
          }
        />
      ) : null}
      <form action={verifyAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label={t("code")}>
          {({ id }) => (
            <Input
              id={id}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          )}
        </Field>
        <Checkbox name="trust" id="trust" label={t("trustDevice")} />
        <Button type="submit" loading={verifying} className="w-full">
          {t("verify")}
        </Button>
      </form>
      {method === "email" ? (
        <Button type="button" variant="secondary" loading={sending} onClick={send}>
          {t("resend")}
        </Button>
      ) : null}
      {showRecovery ? (
        <form action={recoveryAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          {recovery.error ? <Alert tone="critical" title={t("codeWrong")} /> : null}
          <Field label={t("recoveryCode")}>
            {({ id }) => <Input id={id} name="recovery" autoComplete="off" required />}
          </Field>
          <Button type="submit" variant="secondary" loading={recovering}>
            {t("verify")}
          </Button>
        </form>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setShowRecovery(true)}>
          {t("useRecovery")}
        </Button>
      )}
    </div>
  );
}
