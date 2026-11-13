import { brand } from "@rsos/config/brand";
import { getTranslations } from "next-intl/server";
import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = brand.name;

export default async function Image() {
  const t = await getTranslations("home");
  return ogImage(t("headline"), brand.tagline);
}
