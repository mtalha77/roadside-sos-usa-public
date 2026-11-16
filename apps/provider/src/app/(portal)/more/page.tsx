import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { pageMain } from "@/components/shell/page-head";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { isBuilt } from "@/lib/routes";

/** Phones: everything not in the bottom tabs. */
export default async function MorePage() {
  const t = await getTranslations("portal.nav");
  const items = (
    [
      ["/services", t("services")],
      ["/team", t("team")],
      ["/insights", t("insights")],
      ["/notifications", t("notifications")],
      ["/help", t("help")],
      ["/account", t("account")],
      ["/install", t("install")],
    ] as const
  ).filter(([href]) => isBuilt(href));
  return (
    <main id="main" className={pageMain}>
      <h1 className="text-2xl font-semibold">{t("more")}</h1>
      <ul className="divide-y rounded-2xl border bg-card">
        {items.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center justify-between px-4 font-medium"
            >
              {label}
              <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <ThemeSwitch
            label={t("theme")}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium"
          />
        </li>
      </ul>
    </main>
  );
}
