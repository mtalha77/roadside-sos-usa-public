import { AppPlaceholder } from "@rsos/ui/app-placeholder";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("admin");
  const common = await getTranslations("common");
  return (
    <AppPlaceholder
      appLabel={t("label")}
      headline={t("headline")}
      body={t("body")}
      cta={t("cta")}
      comingSoon={common("comingSoon")}
      toggleThemeLabel={common("toggleTheme")}
      skipToContentLabel={common("skipToContent")}
    />
  );
}
