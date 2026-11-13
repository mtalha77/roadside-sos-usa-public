import { brand } from "@rsos/config/brand";
import { getTranslations } from "next-intl/server";
import { serviceName } from "@/components/site/service-label";
import { OG_SIZE, ogImage } from "@/lib/og";
import { getServices } from "@/lib/site-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = brand.name;

export default async function Image({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const svc = (await getServices()).find((s) => s.slug === service);
  const t = await getTranslations("site");
  return svc ? ogImage(serviceName(t, svc), serviceName(t, svc, "short")) : ogImage(brand.name);
}
