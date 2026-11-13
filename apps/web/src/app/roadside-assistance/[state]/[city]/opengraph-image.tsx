import { brand } from "@rsos/config/brand";
import { getTranslations } from "next-intl/server";
import { OG_SIZE, ogImage } from "@/lib/og";
import { getMarketByPath } from "@/lib/site-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = brand.name;

export default async function Image({
  params,
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const market = await getMarketByPath(state, city);
  const t = await getTranslations("site");
  return market
    ? ogImage(t("city.title", { city: market.name, state: market.state_code }), brand.tagline)
    : ogImage(brand.name);
}
