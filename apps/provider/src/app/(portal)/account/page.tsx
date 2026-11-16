import { loadAccount } from "@rsos/account/server";
import { AccountSecurity } from "@rsos/account/components/account-security";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHead, pageMain } from "@/components/shell/page-head";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const data = await loadAccount();
  if (!data) redirect("/sign-in");
  const t = await getTranslations("account");
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} />
      <AccountSecurity data={data} audience="provider" phoneHref="/verify-phone" />
    </main>
  );
}
