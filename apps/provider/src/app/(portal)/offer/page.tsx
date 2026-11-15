import { TIMING } from "@rsos/core/demo";
import { getTranslations } from "next-intl/server";
import { OfferScreen, type OfferView } from "@/components/offer/offer-screen";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const now = Date.now();
  const { data, pricing } = await getPortalData(ctx, now);
  return { now, data, pricing };
}

/** Incoming requests (RSOS-054), from the shared live demo stream for this company's market. */
export default async function OfferPage() {
  const [t, ts, { now, data, pricing }] = await Promise.all([
    getTranslations("portal.offer"),
    getTranslations("site.services"),
    load(),
  ]);
  const offers: OfferView[] = data.offers.map((o) => {
    const r = o.request;
    const range = pricing.find((p) => p.service_slug === r.serviceSlug);
    const fastest = [...r.quotes].sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
    return {
      id: r.id,
      code: r.code,
      service: ts.has(`${r.serviceSlug}.name`) ? ts(`${r.serviceSlug}.name`) : r.serviceSlug,
      vehicle: `${r.vehicle.year} ${r.vehicle.color} ${r.vehicle.make} ${r.vehicle.model}`,
      ev: r.vehicle.ev,
      area: r.location.area,
      lat: r.location.lat,
      lng: r.location.lng,
      miles: o.miles,
      driveMinutes: o.driveMinutes,
      towMiles: r.destination?.miles ?? null,
      onHighway: r.safety.onHighway,
      passengers: r.safety.passengers,
      safe: r.safety.safe,
      expiresAt: o.expiresAt,
      pickAt: r.createdAt + TIMING.pickAt * 1000,
      suggestedCents: o.suggestedCents,
      minCents: range?.price_min_cents ?? 5000,
      maxCents: range?.price_max_cents ?? 20000,
      feeCents: o.feeCents,
      winningEta: fastest?.etaMinutes ?? 30,
    };
  });
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <OfferScreen offers={offers} now={now} />
    </main>
  );
}
