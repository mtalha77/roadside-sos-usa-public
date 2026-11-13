import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { PhoneVerification } from "./phone-form";

export const dynamic = "force-dynamic";

export default async function VerifyPhonePage() {
  const t = await getTranslations("auth.provider");
  return (
    <AuthShell title={t("phoneTitle")} subtitle={t("phoneBody")}>
      <PhoneVerification />
    </AuthShell>
  );
}
