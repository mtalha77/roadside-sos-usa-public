import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const t = await getTranslations("auth.admin");
  const { expired } = await searchParams;
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <SignInForm expired={expired === "1"} />
    </AuthShell>
  );
}
