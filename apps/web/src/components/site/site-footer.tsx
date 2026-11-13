import { brand } from "@rsos/config/brand";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cityLabel, formatPhone, marketPath, type SiteMarket } from "@/lib/market";
import type { SiteService } from "@/lib/site-data";
import { PrivacyChoicesButton } from "./consent-manager";
import { serviceName } from "./service-label";

/** Footer: cities, services, company, legal and provider links, and the visitor's market number. */
export async function SiteFooter({
  markets,
  services,
  market,
}: {
  markets: SiteMarket[];
  services: SiteService[];
  market: SiteMarket | null;
}) {
  const t = await getTranslations("site");
  const link =
    "inline-flex min-h-touch items-center hover:underline underline-offset-4 sm:min-h-0 sm:py-1";
  const heading = "mb-2 font-semibold";
  const cols: { title: string; items: { href: string; label: string }[] }[] = [
    {
      title: t("footer.cities"),
      items: markets.map((m) => ({ href: marketPath(m), label: `${m.name}, ${m.state_code}` })),
    },
    {
      title: t("footer.services"),
      items: services
        .filter((s) => s.market_count > 0)
        .map((s) => ({ href: `/services/${s.slug}`, label: serviceName(t, s) })),
    },
    {
      title: t("footer.company"),
      items: [
        { href: "/how-it-works", label: t("footer.howItWorks") },
        { href: "/faq", label: t("footer.faq") },
        { href: "/about", label: t("footer.about") },
        { href: "/contact", label: t("footer.contact") },
        { href: "/safety", label: t("footer.safety") },
      ],
    },
    {
      title: t("footer.providers"),
      items: [
        { href: "/for-providers", label: t("nav.forProviders") },
        { href: "/for-providers/apply", label: t("footer.apply") },
        { href: `${brand.urls.provider}/sign-in`, label: t("footer.providerSignIn") },
      ],
    },
    {
      title: t("footer.legal"),
      items: [
        { href: "/legal/driver-terms", label: t("footer.driverTerms") },
        { href: "/legal/provider-terms", label: t("footer.providerTerms") },
        { href: "/legal/privacy", label: t("footer.privacy") },
        { href: "/legal/sms-terms", label: t("footer.smsTerms") },
        { href: "/legal/call-recording", label: t("footer.callRecording") },
        { href: "/legal/cookies", label: t("footer.cookies") },
        { href: "/legal/accessibility", label: t("footer.accessibility") },
      ],
    },
  ];
  return (
    <footer className="mt-16 border-t bg-muted/40 pb-28 sm:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className={heading}>{c.title}</h2>
            <ul className="flex flex-col">
              {c.items.map((i) => (
                <li key={i.href}>
                  <Link className={link} href={i.href}>
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 border-t px-4 py-6 text-sm text-muted-foreground">
        {market?.phone ? (
          <p>
            <a
              className="font-semibold text-foreground tabular-nums underline-offset-4 hover:underline"
              href={`tel:${market.phone}`}
            >
              {formatPhone(market.phone)}
            </a>{" "}
            <span aria-hidden="true">{" · "}</span>
            {cityLabel(market)}
          </p>
        ) : null}
        <p className="max-w-3xl">{t("footer.tagline")}</p>
        <p>
          <PrivacyChoicesButton label={t("footer.privacyChoices")} />
        </p>
        <p>{t("footer.rights", { year: new Date().getFullYear(), brand: brand.name })}</p>
      </div>
    </footer>
  );
}
