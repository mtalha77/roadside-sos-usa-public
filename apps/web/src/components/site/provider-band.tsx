import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** Provider recruitment band. */
export async function ProviderBand() {
  const t = await getTranslations("home.providers");
  return (
    <section
      aria-labelledby="providers-band"
      className="flex flex-col gap-4 rounded-2xl bg-foreground p-6 text-background sm:p-10"
    >
      <h2 id="providers-band" className="text-2xl font-semibold sm:text-3xl">
        {t("title")}
      </h2>
      <p className="max-w-2xl text-lg opacity-90">{t("body")}</p>
      <Button asChild variant="secondary" className="self-start">
        <Link href="/for-providers">{t("cta")}</Link>
      </Button>
    </section>
  );
}
