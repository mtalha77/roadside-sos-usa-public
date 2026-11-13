import { GateProof } from "./gate-proof";
import { AppPlaceholder } from "@rsos/ui/app-placeholder";
import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("web");
  const common = await getTranslations("common");
  return (
    <>
      <GateProof />
      <AppPlaceholder
        appLabel={t("label")}
        headline={t("headline")}
        body={t("body")}
        cta={t("cta")}
        comingSoon={common("comingSoon")}
        toggleThemeLabel={common("toggleTheme")}
        skipToContentLabel={common("skipToContent")}
      />
    </>
  );
}
