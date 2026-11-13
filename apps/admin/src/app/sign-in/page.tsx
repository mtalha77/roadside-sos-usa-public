import { Alert } from "@rsos/ui/alert";
import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; signedOut?: string }>;
}) {
  const t = await getTranslations("auth.admin");
  const { expired, signedOut } = await searchParams;
  const ta = await getTranslations("account");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      {signedOut === "1" ? <Alert tone="info" title={ta("signedOutNotice")} /> : null}
      <SignInForm expired={expired === "1"} />
      <a
        href="/forgot-password"
        className="inline-flex min-h-touch items-center self-center underline underline-offset-4"
      >
        {ta("forgot")}
      </a>
    </AuthShell>
  );
}
