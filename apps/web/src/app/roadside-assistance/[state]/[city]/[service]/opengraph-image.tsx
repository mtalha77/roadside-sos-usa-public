import { brand } from "@rsos/config/brand";
import { getTranslations } from "next-intl/server";
import { serviceName } from "@/components/site/service-label";
import { OG_SIZE, ogImage } from "@/lib/og";
import { getMarketByPath, getMarketServices } from "@/lib/site-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = brand.name;

export default async function Image({
  params,
}: {
  params: Promise<{ state: string; city: string; service: string }>;
}) {
  const { state, city, service } = await params;
  const market = await getMarketByPath(state, city);
  const svc = market
    ? (await getMarketServices(market.slug)).find((s) => s.service_slug === service)
    : undefined;
  if (!market || !svc) return ogImage(brand.name);
  const t = await getTranslations("site");
  const name = serviceName(t, { slug: svc.service_slug, name: svc.service_name });
  return ogImage(
    t("cityService.title", { service: name, city: market.name }),
    `${market.name}, ${market.state_code}`,
  );
}
