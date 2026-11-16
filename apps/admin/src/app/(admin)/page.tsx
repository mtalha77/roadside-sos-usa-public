import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";
import { getAdminContext } from "@/lib/admin";
import { builtSections } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Admin overview: who is signed in, the markets in view and a link to every section. */
export default async function AdminHome() {
  const [t, ta, ctx] = await Promise.all([
    getTranslations("admin"),
    getTranslations("auth"),
    getAdminContext(),
  ]);
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{ta("admin.dashboardTitle")}</h1>
          <p className="text-muted-foreground">
            {ta("admin.signedInAs", { email: ctx.email, role: ctx.role })}
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            {ta("signOut")}
          </Button>
        </form>
      </header>
      <section aria-labelledby="mk-h" className="rounded-2xl border bg-card p-5">
        <h2 id="mk-h" className="mb-2 font-semibold">
          {t("overview.markets")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {inView.map((m) => (
            <li key={m.slug} className="rounded-full border px-3 py-1 text-sm">
              {m.name} · {t(`overview.status.${m.status}`)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sec-h">
        <h2 id="sec-h" className="mb-3 text-lg font-semibold">
          {t("overview.sections")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builtSections().map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex min-h-16 flex-col justify-center rounded-2xl border bg-card p-4 hover:bg-accent"
              >
                <span className="font-semibold">{t(`sections.${s.key}`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t("overview.shortcut", { keys: s.shortcut })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t("overview.tip")}</p>
      </section>
    </main>
  );
}
