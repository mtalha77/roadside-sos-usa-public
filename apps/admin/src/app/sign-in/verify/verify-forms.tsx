"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { OTPInput } from "@rsos/ui/otp-input";
import { Skeleton } from "@rsos/ui/skeleton";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { type AuthFormState, startEnrollAction, verifyCodeAction } from "@/lib/auth-actions";

function CodeForm({ factorId }: { factorId: string }) {
  const t = useTranslations("auth");
  const [code, setCode] = useState("");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(verifyCodeAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="code" value={code} />
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      <OTPInput
        aria-label={t("code")}
        value={code}
        onChange={setCode}
        invalid={Boolean(state.error)}
      />
      <Button type="submit" loading={pending} disabled={code.length !== 6} className="w-full">
        {t("verify")}
      </Button>
    </form>
  );
}

export function VerifyExisting({ factorId }: { factorId: string }) {
  return <CodeForm factorId={factorId} />;
}

/** First sign-in: set up the authenticator app, then verify a code. */
export function EnrollAuthenticator() {
  const t = useTranslations("auth");
  const [enrollment, setEnrollment] = useState<Awaited<
    ReturnType<typeof startEnrollAction>
  > | null>(null);
  useEffect(() => {
    void startEnrollAction().then(setEnrollment);
  }, []);
  if (!enrollment) return <Skeleton className="mx-auto size-48" />;
  if ("error" in enrollment)
    return <Alert tone="critical" title={t(`errors.${enrollment.error ?? "generic"}`)} />;
  return (
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Supabase, not an optimisable asset */}
      <img
        src={enrollment.qr}
        alt={t("admin.enrollTitle")}
        className="mx-auto size-48 rounded-lg bg-surface p-2"
      />
      <p className="text-sm text-muted-foreground">
        {t("admin.secretLabel")}{" "}
        <code className="font-mono break-all text-foreground">{enrollment.secret}</code>
      </p>
      <CodeForm factorId={enrollment.factorId} />
    </div>
  );
}
