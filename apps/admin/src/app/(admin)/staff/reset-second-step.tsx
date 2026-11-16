"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { resetSecondStepAction, type StaffActionState } from "@/lib/staff-actions";

export function ResetSecondStep({ userId }: { userId: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<StaffActionState, FormData>(
    resetSecondStepAction,
    {},
  );
  if (state.ok !== undefined)
    return <Alert tone="success" title={t("resetDoneFor", { email: state.ok })} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      {state.error ? (
        <Alert
          tone="critical"
          title={state.error === "forbidden" ? t("onlySuperAdmin") : t("genericError")}
        />
      ) : null}
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        {t("resetSecondStep")}
      </Button>
    </form>
  );
}
