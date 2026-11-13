import { parseClaims } from "@rsos/db/claims";
import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

/** Admin home (protected by the proxy: staff with aal2 only). Real dashboards arrive with the admin tickets. */
export default async function AdminHome() {
  const t = await getTranslations("auth");
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = parseClaims(data?.claims);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">{t("admin.dashboardTitle")}</h1>
      <p className="text-muted-foreground">
        {t("admin.signedInAs", { email: claims?.email ?? "", role: claims?.staff_role ?? "" })}
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}
