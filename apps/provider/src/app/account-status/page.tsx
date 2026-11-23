import { loadProviderStatus } from "@rsos/account/server";
import { AccountStatus } from "@rsos/account/components/account-status";
import { brand } from "@rsos/config/brand";
import { AuthShell } from "@rsos/ui/auth-shell";
import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

/** Paused, suspended or closed providers land here with the reason and the next step. */
export default async function AccountStatusPage() {
  const status = await loadProviderStatus();
  if (!status || !["paused", "suspended", "closed"].includes(status.status)) redirect("/");
  const t = await getTranslations("auth");
  return (
    <AuthShell title={status.name}>
      <AccountStatus
        status={status.status}
        reason={status.status_reason}
        support={brand.emails.support}
      />
      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          {t("signOut")}
        </Button>
      </form>
    </AuthShell>
  );
}
