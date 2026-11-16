import { getTranslations } from "next-intl/server";
import { IntroEditor } from "@/components/content/intro-editor";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getAdminContext();
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("markets")
    .select("slug, name, seo_intro")
    .in("slug", ctx.selected)
    .order("name");
  return { ctx, markets: data ?? [] };
}

/**
 * Content manager (RSOS-082): city intros with preview and publish (real, audited). FAQs, service
 * copy and banners stay in the message files for now and are listed here for reference.
 */
export default async function ContentPage() {
  const [t, { ctx, markets }] = await Promise.all([getTranslations("admin.content"), load()]);
  const canEdit = ["super_admin", "ops_manager"].includes(ctx.role);
  const labels = Object.fromEntries(
    [
      "intro",
      "count",
      "publish",
      "readOnly",
      "saved",
      "invalid",
      "forbidden",
      "error",
      "preview",
      "previewTitle",
    ].map((k) => [k, String(t.raw(k))]),
  );
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
      {markets.map((m) => (
        <IntroEditor
          key={m.slug}
          slug={m.slug}
          name={m.name}
          initial={m.seo_intro ?? ""}
          canEdit={canEdit}
          labels={labels}
        />
      ))}
      <section aria-labelledby="other-h" className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="other-h" className="mb-2 font-semibold">
          {t("other")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("otherHint")}</p>
      </section>
    </main>
  );
}
