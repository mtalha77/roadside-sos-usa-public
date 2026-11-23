import { Button } from "@rsos/ui/button";
import { EmptyState } from "@rsos/ui/empty-state";
import { inputClass } from "@rsos/ui/input";
import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, PageHead, pageMain } from "@/components/shell/page-head";

const ARTICLES = ["quotes", "fees", "wallet", "online", "photos", "disputes", "team", "documents"];

/** Help center (RSOS-063): searchable articles (plain GET form, no client JS) and chat. */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, sp] = await Promise.all([getTranslations("portal.help"), searchParams]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const articles = ARTICLES.map((id) => ({
    id,
    title: t(`articles.${id}.title`),
    body: t(`articles.${id}.body`),
  })).filter((a) => !q || `${a.title} ${a.body}`.toLowerCase().includes(q));
  return (
    <main id="main" className={pageMain}>
      <PageHead
        title={t("title")}
        action={
          <Button asChild>
            <Link href="/help/chat">
              <MessageSquare aria-hidden="true" />
              {t("chat")}
            </Link>
          </Button>
        }
      />
      <form role="search" className="flex gap-2">
        <label htmlFor="help-q" className="sr-only">
          {t("search")}
        </label>
        <input
          id="help-q"
          name="q"
          type="search"
          defaultValue={sp.q ?? ""}
          placeholder={t("search")}
          className={inputClass}
        />
        <Button type="submit" variant="outline">
          {t("go")}
        </Button>
      </form>
      {articles.length === 0 ? (
        <EmptyState title={t("none")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {articles.map((a) => (
            <li key={a.id}>
              <details className={card}>
                <summary className="flex min-h-12 cursor-pointer items-center font-semibold">
                  {a.title}
                </summary>
                <p className="mt-2 text-muted-foreground">{a.body}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
