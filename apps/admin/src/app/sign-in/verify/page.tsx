import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { EnrollAuthenticator, VerifyExisting } from "./verify-forms";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const t = await getTranslations("auth.admin");
  const ta = await getTranslations("account");
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified");
  return totp ? (
    <AuthShell title={t("verifyTitle")} subtitle={t("verifyBody")}>
      <VerifyExisting factorId={totp.id} />
      <p className="text-sm text-muted-foreground">{ta("lostSecondStepAdmin")}</p>
    </AuthShell>
  ) : (
    <AuthShell title={t("enrollTitle")} subtitle={t("enrollBody")}>
      <EnrollAuthenticator />
    </AuthShell>
  );
}
