import { brand } from "@rsos/config/brand";
import { serviceIcons, type ServiceIconKey } from "@rsos/ui/icons";
import { inputClass } from "@rsos/ui/input";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Choice } from "@/components/get-help/choice";
import { LocateButton } from "@/components/get-help/locate-button";
import { AddressField } from "@/components/get-help/address-field";
import { StepShell } from "@/components/get-help/step-shell";
import { MapView } from "@/components/site/map-view";
import { OutsideArea } from "@/components/site/outside-area";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import {
  allowedStep,
  COLORS,
  type Draft,
  DraftSchema,
  DRAFT_COOKIE,
  FOLLOW_UPS,
  MILE_RANGES,
  NEEDS_DESTINATION,
  previousStep,
  STEPS,
  VEHICLE_MAKES,
} from "@/lib/get-help";
import { cityLabel, formatPhone } from "@/lib/market";
import { pageMetadata } from "@/lib/seo";
import { getMarkets, getMarketServices, getServices } from "@/lib/site-data";
import { orderTiles } from "@/lib/tiles";
import { ui } from "@/lib/ui-classes";
import { getVisitorMarket } from "@/lib/visitor";
import { mapsEnabled } from "@rsos/core/adapters";
import { createPublicSupabase } from "@rsos/db/public";

// Written out in full so Tailwind generates them: each follow-up shows when its service is picked.
const SHOW_WHEN: Record<string, string> = {
  "flat-tire": "[form:has(#svc-flat-tire:checked)_&]:flex",
  "locked-out": "[form:has(#svc-locked-out:checked)_&]:flex",
  "out-of-gas": "[form:has(#svc-out-of-gas:checked)_&]:flex",
  "wont-start": "[form:has(#svc-wont-start:checked)_&]:flex",
};

// Only the last step loads the Turnstile widget.
const Turnstile = nextDynamic(() => import("@/components/site/turnstile").then((m) => m.Turnstile));

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.placeholder");
  return pageMetadata({ title: t("getHelpTitle"), path: "/get-help", noindex: true });
}

type SP = Record<string, string | undefined>;

async function loadDraft(): Promise<Draft> {
  const token = (await cookies()).get(DRAFT_COOKIE)?.value;
  const supabase = createPublicSupabase();
  if (!token || !supabase) return {};
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
  )("get_request_draft", { p_token: token });
  return DraftSchema.safeParse(data ?? {}).data ?? {};
}

/** The step's main button, in the bottom thumb zone on a phone (sticky), full width. */
function Submit({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
      <button type="submit" className={`${ui.button.primary} min-h-14 w-full text-lg`}>
        {children}
      </button>
    </div>
  );
}

/**
 * Get Help (RSOS-021, three screens since RSOS-101): (1) what happened, skipped when a home tile
 * was tapped; (2) where: GPS first, or a typed address and a landmark, plus the destination for a
 * tow; (3) name, phone and vehicle, then submit. Saved to a draft after every screen, so Back and a
 * reload keep the answers. Plain forms: works without JavaScript and stays inside the budget.
 */
export default async function GetHelpPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [t, ts, draft, markets, detection] = await Promise.all([
    getTranslations("getHelp"),
    getTranslations("site"),
    loadDraft(),
    getMarkets(),
    getVisitorMarket(sp.market),
  ]);
  const tileService = sp.service && /^[a-z-]{2,40}$/.test(sp.service) ? sp.service : undefined;
  // A home tile chose the service: start at the location step with it (no "what happened").
  const effective: Draft =
    tileService && !draft.service ? { ...draft, service: tileService } : draft;
  const step = allowedStep(effective, sp.step);
  const n = STEPS.indexOf(step) + 1;
  const back = previousStep(effective, step);
  const backHref = back ? `/get-help?step=${back}` : "/";
  const savedFix = draft.lat !== undefined && draft.lng !== undefined && !draft.approx;
  const error = sp.error ?? null;
  const market =
    markets.find(
      (m) =>
        m.slug ===
        (draft.market ?? (detection.kind === "market" ? detection.market.slug : undefined)),
    ) ?? null;
  const hidden = (name: string, value: string | number | undefined | null) =>
    value === undefined || value === null ? null : (
      <input type="hidden" name={name} value={String(value)} />
    );
  const label = "flex flex-col gap-2 font-medium";
  const fieldset = "flex flex-col gap-3";

  let body;
  if (step === "problem") {
    // The market's services when it is known; otherwise every service offered somewhere (the
    // location step checks it is offered there).
    const services = market
      ? (await getMarketServices(market.slug))
          .filter((s) => s.enabled)
          .map((s) => ({ slug: s.service_slug, name: s.service_name, icon_key: s.icon_key }))
      : (await getServices()).filter((s) => s.market_count > 0);
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "problem")}
        {hidden("market", market?.slug)}
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">{t("problem.title")}</legend>
          {orderTiles(services).map((s) => {
            const Glyph = serviceIcons[s.icon_key as ServiceIconKey];
            return (
              <label
                key={s.slug}
                className="flex min-h-24 cursor-pointer flex-col items-start justify-between gap-2 rounded-2xl border-2 border-border bg-surface p-4 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  id={`svc-${s.slug}`}
                  type="radio"
                  name="service"
                  value={s.slug}
                  defaultChecked={draft.service === s.slug}
                  required
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-xl bg-muted [&_svg]:size-6"
                >
                  {Glyph ? <Glyph /> : null}
                </span>
                <span className="text-lg leading-tight font-semibold">
                  {serviceName(ts, s, "tile")}
                </span>
              </label>
            );
          })}
        </fieldset>
        {Object.entries(FOLLOW_UPS).map(([slug, fu]) => (
          <fieldset key={slug} className={`${fieldset} hidden ${SHOW_WHEN[slug] ?? ""}`}>
            <legend className="mb-1 font-semibold">{t(`problem.${fu.key}.q` as never)}</legend>
            {fu.options.map((o) => (
              <Choice
                key={o}
                name={`followUp-${slug}`}
                value={o}
                checked={draft.service === slug && draft.followUp === o}
                required={false}
              >
                {t(`problem.${fu.key}.${o}` as never)}
              </Choice>
            ))}
          </fieldset>
        ))}
        <Submit>{t("next")}</Submit>
      </form>
    );
  } else if (step === "location") {
    const needsDestination = NEEDS_DESTINATION.has(effective.service ?? "");
    body = sp.outside ? (
      <OutsideArea city={null} region={null} markets={markets} />
    ) : (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "location")}
        <input type="hidden" name="lat" defaultValue={savedFix ? String(draft.lat) : ""} />
        <input type="hidden" name="lng" defaultValue={savedFix ? String(draft.lng) : ""} />
        {savedFix ? hidden("fix", "saved") : null}
        {hidden("service", tileService)}
        {[
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "gclid",
          "gbraid",
          "wbraid",
          "fbclid",
          "msclkid",
        ].map((k) => hidden(k, sp[k]?.slice(0, 200)))}
        <p className="text-muted-foreground">{t("location.why")}</p>
        {savedFix ? (
          <MapView
            label={t("location.mapLabel")}
            points={[
              {
                id: "me",
                kind: "request",
                lat: draft.lat!,
                lng: draft.lng!,
                label: draft.address || t("location.mapLabel"),
              },
            ]}
          />
        ) : null}
        {savedFix ? (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm font-medium">
            {draft.address
              ? t("location.saved", { place: draft.address })
              : t("location.savedNoPlace")}
          </p>
        ) : null}
        <LocateButton
          label={t("location.useMine")}
          busyLabel={t("location.locating")}
          deniedLabel={t("location.denied")}
          fallbackId="gh-address"
          auto={!savedFix && !error}
        />
        <p className="text-sm font-medium text-muted-foreground">{t("location.or")}</p>
        <label className={label}>
          {t("location.address")}
          <AddressField
            id="gh-address"
            name="address"
            defaultValue={draft.approx ? (draft.address ?? "") : ""}
            autoComplete="street-address"
            className={inputClass}
            listLabel={t("location.suggestions")}
            suggest={mapsEnabled()}
          />
        </label>
        <label className={label}>
          {t("location.city")}
          <select name="market" defaultValue={market?.slug ?? ""} className={inputClass}>
            <option value="" disabled>
              {ts("market.none")}
            </option>
            {markets.map((m) => (
              <option key={m.slug} value={m.slug}>
                {cityLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("location.note")}
          <textarea
            name="note"
            rows={2}
            defaultValue={draft.note ?? ""}
            className={inputClass}
            aria-describedby="gh-note-hint"
          />
          <span id="gh-note-hint" className="text-sm font-normal text-muted-foreground">
            {t("location.notePlaceholderHint")}
          </span>
        </label>
        {needsDestination ? (
          <fieldset className="flex flex-col gap-4 rounded-2xl border p-4">
            <legend className="px-1 text-lg font-semibold">{t("destination.title")}</legend>
            <label className={label}>
              {t("destination.address")}
              <input
                name="destAddress"
                required
                defaultValue={draft.destAddress ?? ""}
                className={inputClass}
              />
            </label>
            <label className={label}>
              {t("destination.miles")}
              <select
                name="destMiles"
                defaultValue={draft.destMiles ?? "lt5"}
                className={inputClass}
              >
                {Object.keys(MILE_RANGES).map((k) => (
                  <option key={k} value={k}>
                    {t(`destination.ranges.${k}` as never)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">{t("destination.note")}</p>
          </fieldset>
        ) : null}
        <Submit>{t("next")}</Submit>
      </form>
    );
  } else {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "details")}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            {t("contact.name")}
            <input
              name="name"
              required
              autoComplete="name"
              defaultValue={draft.name ?? ""}
              className={inputClass}
            />
          </label>
          <label className={label}>
            {t("contact.phone")}
            <input
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              defaultValue={draft.phone ? formatPhone(draft.phone) : ""}
              className={inputClass}
            />
          </label>
          <label className={label}>
            {t("vehicle.make")}
            <input
              name="make"
              list="gh-makes"
              required
              defaultValue={draft.make ?? ""}
              autoComplete="off"
              className={inputClass}
            />
            <datalist id="gh-makes">
              {VEHICLE_MAKES.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className={label}>
            {t("vehicle.color")}
            <select name="color" defaultValue={draft.color ?? "White"} className={inputClass}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {t(`vehicle.colors.${c}` as never)}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("vehicle.modelOptional")}
            <input name="model" defaultValue={draft.model ?? ""} className={inputClass} />
          </label>
          <label className={label}>
            {t("contact.email")}
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={draft.email ?? ""}
              className={inputClass}
              aria-describedby="gh-email-hint"
            />
            <span id="gh-email-hint" className="text-sm font-normal text-muted-foreground">
              {t("contact.emailHint")}
            </span>
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{t("safety.where")}</legend>
          <Choice name="spot" value="safe" checked={draft.safe === true && draft.highway === false}>
            {t("safety.spotSafe")}
          </Choice>
          <Choice
            name="spot"
            value="highway"
            checked={draft.safe === true && draft.highway === true}
          >
            {t("safety.spotHighway")}
          </Choice>
          <Choice name="spot" value="unsafe" id="gh-unsafe" checked={draft.safe === false}>
            {t("safety.spotUnsafe")}
          </Choice>
        </fieldset>
        <div
          role="alert"
          className="hidden flex-col gap-3 rounded-2xl border-2 border-critical bg-critical-subtle p-4 [form:has(#gh-unsafe:checked)_&]:flex"
        >
          <p className="font-semibold">{t("safety.unsafe")}</p>
          <a href="tel:911" className={`${ui.button.primary} self-start`}>
            {t("safety.call911")}
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          {t.rich("contact.consent", {
            terms: (chunks) => (
              <Link className="underline underline-offset-4" href="/legal/driver-terms">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link className="underline underline-offset-4" href="/legal/privacy">
                {chunks}
              </Link>
            ),
          })}
        </p>
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
          <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} label={brand.name} />
        ) : null}
        <Submit>{t("details.submit")}</Submit>
      </form>
    );
  }

  return (
    <SitePage marketSlug={market?.slug} bar={false}>
      <StepShell
        n={n}
        total={STEPS.length}
        title={t(`${step}.title` as never)}
        back={backHref}
        error={error}
      >
        {body}
      </StepShell>
    </SitePage>
  );
}
