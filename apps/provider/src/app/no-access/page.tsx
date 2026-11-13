import { AuthShell } from "@rsos/ui/auth-shell";
import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { signOutAction } from "@/lib/auth-actions";

export default async function NoAccessPage() {
  const t = await getTranslations("auth");
  return (
    <AuthShell title={t("provider.noAccessTitle")} subtitle={t("provider.noAccessBody")}>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          {t("signOut")}
        </Button>
      </form>
    </AuthShell>
  );
}
