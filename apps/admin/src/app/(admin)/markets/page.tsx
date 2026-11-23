import { Badge } from "@rsos/ui/badge";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Markets (RSOS-077): every market from the database with status, time zone and coverage. */
export default async function MarketsPage() {
  const [t, ctx] = await Promise.all([getTranslations("admin.markets"), getAdminContext()]);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ctx.markets.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/markets/${m.slug}`}
              prefetch={false}
              className="flex min-h-24 flex-col gap-2 rounded-2xl border bg-card p-4 hover:bg-accent"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{m.name}</span>
                <Badge
                  tone={
                    m.status === "active" ? "success" : m.status === "test" ? "info" : "neutral"
                  }
                >
                  {t(`status.${m.status}`)}
                </Badge>
              </span>
              <span className="text-sm text-muted-foreground">{m.timeZone}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
