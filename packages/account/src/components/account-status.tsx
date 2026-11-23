import { Alert } from "@rsos/ui/alert";
import { getTranslations } from "next-intl/server";

/** Paused, suspended or closed provider: the reason and the next step, nothing else. */
export async function AccountStatus({
  status,
  reason,
  support,
}: {
  status: string;
  reason: string | null;
  support: string;
}) {
  const t = await getTranslations("account");
  const label = t.has(`status.${status}`) ? t(`status.${status}`) : status;
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title={t("statusTitle", { status: label })}>
        {reason ? <p>{t("statusReason", { reason })}</p> : null}
      </Alert>
      <p>{t("statusNext", { support })}</p>
    </div>
  );
}
