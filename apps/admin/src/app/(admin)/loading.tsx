import { Skeleton } from "@rsos/ui/skeleton";
import { getTranslations } from "next-intl/server";

/** Every admin page streams behind this skeleton (RSOS-103): header, a strip of cards, a list. */
export default async function AdminLoading() {
  const t = await getTranslations("admin.states");
  return (
    <main id="main" aria-busy="true" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
