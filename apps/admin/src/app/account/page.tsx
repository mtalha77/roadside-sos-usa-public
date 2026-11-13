import { loadAccount } from "@rsos/account/server";
import { AccountSecurity } from "@rsos/account/components/account-security";
import { parseClaims } from "@rsos/db/claims";
import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const data = await loadAccount();
  if (!data) redirect("/sign-in");
  const t = await getTranslations("account");
  const { data: c } = await (await getServerSupabase()).auth.getClaims();
  const isSuper = parseClaims(c?.claims)?.staff_role === "super_admin";
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      {isSuper ? (
        <Button asChild variant="outline" className="self-start">
          <a href="/staff">{t("staff")}</a>
        </Button>
      ) : null}
      <AccountSecurity data={data} audience="admin" />
    </main>
  );
}
