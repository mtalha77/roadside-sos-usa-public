import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { ProviderSignIn } from "./sign-in-forms";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const t = await getTranslations("auth.provider");
  const { expired } = await searchParams;
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <ProviderSignIn expired={expired === "1"} />
    </AuthShell>
  );
}
