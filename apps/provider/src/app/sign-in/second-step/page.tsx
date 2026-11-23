import { loadSecondStepContext } from "@rsos/account/server";
import { tryTrustedDevice } from "@rsos/account/actions";
import { SecondStepForm } from "@rsos/account/components/second-step";
import { AuthShell } from "@rsos/ui/auth-shell";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const safeNext = (v: string | undefined) =>
  v && v.startsWith("/") && !v.startsWith("//") ? v : "/";

/** Second step after password or email link: a trusted device skips it; otherwise a code. */
export default async function SecondStepPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const ctx = await loadSecondStepContext();
  if (!ctx) redirect("/sign-in");
  if (await tryTrustedDevice()) redirect(next);
  const t = await getTranslations("account");
  return (
    <AuthShell title={t("secondStepTitle")}>
      <SecondStepForm email={ctx.email} method={ctx.method} next={next} />
    </AuthShell>
  );
}
