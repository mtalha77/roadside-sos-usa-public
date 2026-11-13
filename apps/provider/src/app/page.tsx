import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth-actions";
import { isPhoneVerified, phoneVerifier } from "@/lib/phone";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Provider home (protected by the proxy). A verified phone is required before anything else. */
export default async function ProviderHome() {
  const t = await getTranslations("auth");
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  if (!isPhoneVerified(data.user, phoneVerifier(supabase).kind)) redirect("/verify-phone");
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">{t("provider.dashboardTitle")}</h1>
      <p className="text-muted-foreground">
        {t("provider.signedInAs", { email: data.user.email ?? "" })}
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}
