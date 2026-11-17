import { Alert } from "@rsos/ui/alert";
import { DemoSignIn } from "@rsos/account/components/demo-sign-in";
import { EmailCodeSignIn } from "@rsos/account/components/email-code-sign-in";
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
  const tauth = await getTranslations("auth");
  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      {signedOut === "1" ? <Alert tone="info" title={ta("signedOutNotice")} /> : null}
      <SignInForm expired={expired === "1"} />
      <details className="rounded-xl border p-4">
        <summary className="flex min-h-touch cursor-pointer items-center font-medium">
          {tauth("emailCode.tab")}
        </summary>
        <div className="pt-3">
          <EmailCodeSignIn />
        </div>
      </details>
      <DemoSignIn roles={["admin_super", "admin_dispatcher"]} />
      <a
        href="/forgot-password"
        className="inline-flex min-h-touch items-center self-center underline underline-offset-4"
      >
        {ta("forgot")}
      </a>
    </AuthShell>
  );
}
