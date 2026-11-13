import { loadAccount } from "@rsos/account/server";
import { AccountSecurity } from "@rsos/account/components/account-security";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const data = await loadAccount();
  if (!data) redirect("/sign-in");
  const t = await getTranslations("account");
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <AccountSecurity data={data} audience="provider" phoneHref="/verify-phone" />
    </main>
  );
}
