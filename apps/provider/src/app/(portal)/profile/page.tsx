import { getTranslations } from "next-intl/server";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const { data } = await getPortalData(ctx, Date.now());
  return { ctx, provider: data.provider, sample: data.offers[0] ?? null };
}

/**
 * Public profile editor (RSOS-059): photos, description, hours, payment methods and trucks shown,
 * with a live preview of the profile card and the quote drivers see, and a strength meter.
 */
export default async function ProfilePage() {
  const [t, { ctx, provider }] = await Promise.all([getTranslations("portal.profile"), load()]);
  const k = (key: string) => t(key);
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <ProfileEditor
        company={ctx.company || provider.name}
        logo={ctx.companyLogo ?? provider.logo}
        rating={provider.rating}
        reviews={provider.reviews}
        trucks={provider.trucks}
        labels={Object.fromEntries(
          [
            "photos",
            "addPhoto",
            "photoAlt",
            "description",
            "descriptionHint",
            "hours",
            "payments",
            "trucksShown",
            "preview",
            "profileCard",
            "quoteCard",
            "strength",
            "tips",
            "tipPhoto",
            "tipDescription",
            "tipHours",
            "tipPayments",
            "done",
            "save",
            "saved",
            "documents",
            "documentsHint",
            "allIn",
            "insured",
            "licensed",
            "newProvider",
            "eta",
          ].map((x) => [x, k(x)]),
        )}
        payments={["card", "cash", "apple_pay", "google_pay", "zelle"].map((p) => ({
          id: p,
          label: t(`methods.${p}`),
        }))}
        ratingLabel={
          provider.rating === null
            ? t("newProvider")
            : t("rating", { rating: provider.rating.toFixed(1), count: provider.reviews })
        }
      />
    </main>
  );
}
