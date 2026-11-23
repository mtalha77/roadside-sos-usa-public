import { ResetPasswordForm } from "@rsos/account/components/password-reset";
import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/** Reached from the reset email (the callback signs the user in for this one step). */
export default async function ResetPasswordPage() {
  const t = await getTranslations("account");
  return (
    <AuthShell title={t("resetTitle")}>
      <ResetPasswordForm signInHref="/sign-in" />
    </AuthShell>
  );
}
