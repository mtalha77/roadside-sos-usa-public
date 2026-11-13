import { ForgotPasswordForm } from "@rsos/account/components/password-reset";
import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("account");
  return (
    <AuthShell title={t("forgotTitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
