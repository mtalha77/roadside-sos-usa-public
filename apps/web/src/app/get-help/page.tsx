import { brand } from "@rsos/config/brand";
import { serviceIcons, type ServiceIconKey } from "@rsos/ui/icons";
import { inputClass } from "@rsos/ui/input";
import type { Metadata } from "next";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import { SOURCE_COOKIE } from "@rsos/core/adapters";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import type { ReactNode } from "react";
import { LocateButton } from "@/components/get-help/locate-button";
import { AddressField } from "@/components/get-help/address-field";
import { FunnelBeacon } from "@/components/get-help/funnel-beacon";
import { StepShell } from "@/components/get-help/step-shell";
import { deviceOf, FLOW_COOKIE, readFlow, recordFunnel } from "@/lib/funnel";
import { FlowForm, FlowTracker } from "@/components/get-help/flow";
import { QuestionFields } from "@/components/get-help/questions";
import { getQuestionOverrides } from "@/lib/questions";
import { isTestHeader } from "@/lib/test-traffic";
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
import { questionsFor } from "@rsos/core/service-questions";

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
  // RSOS-116: one flow route with the step in the URL, /get-help/<service>/<step>. /get-help
  // itself is the service picker; old links (?service=, ?step=) move to the new URLs.
  const urlService = sp.__service && /^[a-z-]{2,40}$/.test(sp.__service) ? sp.__service : null;
  const [t, ts, draft, markets, detection] = await Promise.all([
    getTranslations("getHelp"),
    getTranslations("site"),
    loadDraft(),
    getMarkets(),
    getVisitorMarket(sp.market),
  ]);
  const legacy = sp.service && /^[a-z-]{2,40}$/.test(sp.service) ? sp.service : undefined;
  if (!urlService && (legacy || (sp.step && draft.service)))
    redirect(`/get-help/${legacy ?? draft.service}/${legacy ? "problem" : (sp.step ?? "problem")}`);
  const tileService = urlService ?? undefined;
  // Switching service keeps location, vehicle and contact; the answers belong to one service.
  const effective: Draft = urlService
    ? {
        ...draft,
        service: urlService,
        answers: draft.service === urlService ? draft.answers : {},
      }
    : { ...draft, service: undefined };
  // Screen 1 is always shown for the service (its quick questions), then the rest in order.
  const wanted = (sp.__step ?? "problem") as string;
  const step = !urlService
    ? "problem"
    : draft.service !== urlService
      ? "problem"
      : allowedStep(effective, wanted);
  if (urlService && step !== wanted) redirect(`/get-help/${urlService}/${step}`);
  const n = STEPS.indexOf(step) + 1;
  const back = previousStep(effective, step);
  const backHref = back && urlService ? `/get-help/${urlService}/${back}` : "/";
  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  const nextHref = urlService && nextStep ? `/get-help/${urlService}/${nextStep}` : null;
  const savedFix = draft.lat !== undefined && draft.lng !== undefined && !draft.approx;
  const error = sp.error ?? null;
  const market =
    markets.find(
      (m) =>
        m.slug ===
        (draft.market ?? (detection.kind === "market" ? detection.market.slug : undefined)),
    ) ?? null;
  // Booking funnel (RSOS-111): this session saw this screen (one row per session and screen).
  const jar = await cookies();
  const flow = readFlow(jar.get(FLOW_COOKIE)?.value);
  if (flow) {
    const h = await headers();
    const device = deviceOf(h.get("user-agent"));
    const test = isTestHeader(h);
    after(() =>
      recordFunnel({
        session: flow.session,
        event: "step",
        step,
        market: market?.slug ?? null,
        source: jar.get(SOURCE_COOKIE)?.value ?? null,
        device,
        test,
      }),
    );
  }
  const hidden = (name: string, value: string | number | undefined | null) =>
    value === undefined || value === null ? null : (
      <input type="hidden" name={name} value={String(value)} />
    );
  const label = "flex flex-col gap-2 font-medium";

  let body;
  if (step === "problem" && !urlService) {
    // The service picker: each service opens its own screen 1 (one normal link, no redirects).
    const services = market
      ? (await getMarketServices(market.slug))
          .filter((s) => s.enabled)
          .map((s) => ({ slug: s.service_slug, name: s.service_name, icon_key: s.icon_key }))
      : (await getServices()).filter((s) => s.market_count > 0);
    body = (
      <ul className="grid grid-cols-2 gap-3">
        {orderTiles(services).map((s) => {
          const Glyph = serviceIcons[s.icon_key as ServiceIconKey];
          return (
            <li key={s.slug}>
              <Link
                href={`/get-help/${s.slug}/problem`}
                className="flex h-full min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border-2 border-border bg-surface p-4 hover:border-input focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-xl bg-muted [&_svg]:size-6"
                >
                  {Glyph ? <Glyph /> : null}
                </span>
                <span className="text-lg leading-tight font-semibold">
                  {serviceName(ts, s, "tile")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  } else if (step === "problem") {
    const svc = urlService!;
    const overrides = await getQuestionOverrides(market?.slug ?? null);
    const questions = questionsFor(svc, overrides);
    const offered = market
      ? (await getMarketServices(market.slug)).find((s) => s.service_slug === svc && s.enabled)
      : null;
    const all = await getServices();
    const svcRow = all.find((s) => s.slug === svc);
    // A service no market offers has no screen (a stale link gets a "not found" page).
    if (!svcRow || svcRow.market_count === 0) notFound();
    const missing = (sp.missing ?? "").split(",").filter(Boolean);
    const locale = (await getLocale()) as Locale;
    const formatUsd = (c: number) => formatCurrency(c, locale);
    body = (
      <FlowForm step="problem" multipart className="flex flex-col gap-5">
        {hidden("step", "problem")}
        {hidden("service", svc)}
        {hidden("market", market?.slug)}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-semibold">{serviceName(ts, svcRow, "tile")}</span>
          <Link
            href="/get-help"
            className="inline-flex min-h-touch items-center text-sm font-medium underline underline-offset-4"
          >
            {t("changeService")}
          </Link>
        </p>
        {offered?.price_min_cents && offered.price_max_cents && market ? (
          <p className="text-sm text-muted-foreground">
            {t(svc === "tow" ? "typicalPriceTow" : "typicalPrice", {
              service: serviceName(ts, svcRow, "tile"),
              city: market.name,
              min: formatUsd(offered.price_min_cents),
              max: formatUsd(offered.price_max_cents),
            })}
          </p>
        ) : null}
        <QuestionFields
          service={svc}
          questions={questions}
          answers={effective.answers ?? {}}
          missing={missing}
        />
        {svc === "locked-out" ? (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm">{t("notices.lockedOut")}</p>
        ) : null}
        {svc === "out-of-gas" ? (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm">{t("notices.fuel")}</p>
        ) : null}
        <details className="rounded-2xl border p-4" open={Boolean(draft.notes)}>
          <summary className="min-h-touch cursor-pointer font-semibold">{t("addDetails")}</summary>
          <div className="mt-3 flex flex-col gap-4">
            <label className={label}>
              {t("notes")}
              <textarea
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={draft.notes ?? ""}
                className={inputClass}
                aria-describedby="gh-notes-hint"
              />
              <span id="gh-notes-hint" className="text-sm font-normal text-muted-foreground">
                {t("notesHint")}
              </span>
            </label>
            <label className={label}>
              {t("photos")}
              <input
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className={inputClass}
                aria-describedby="gh-photos-hint"
              />
              <span id="gh-photos-hint" className="text-sm font-normal text-muted-foreground">
                {(draft.photos?.length ?? 0) > 0
                  ? t("photosSaved", { count: draft.photos!.length })
                  : t("photosHint")}
              </span>
            </label>
          </div>
        </details>
        <Submit>{t("next")}</Submit>
      </FlowForm>
    );
  } else if (step === "location") {
    const needsDestination = NEEDS_DESTINATION.has(effective.service ?? "");
    body = sp.outside ? (
      <OutsideArea city={null} region={null} markets={markets} />
    ) : (
      <FlowForm step="location" className="flex flex-col gap-5">
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
      </FlowForm>
    );
  } else {
    body = (
      <FlowForm step="details" className="flex flex-col gap-5">
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
            {t("vehicle.yearOptional")}
            <input
              name="year"
              inputMode="numeric"
              maxLength={4}
              defaultValue={draft.year ? String(draft.year) : ""}
              className={inputClass}
            />
          </label>
          <label className={label}>
            {t("vehicle.plateOptional")}
            <input
              name="plate"
              maxLength={12}
              autoCapitalize="characters"
              defaultValue={draft.plate ?? ""}
              className={inputClass}
            />
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
        {/* A repeat request from the account skips screen 1: safety is asked here instead. */}
        {!effective.answers?.safety ? (
          <QuestionFields
            questions={questionsFor(urlService ?? "").filter((q) => q.id === "safety")}
            answers={{}}
            missing={(sp.missing ?? "").split(",").filter(Boolean)}
          />
        ) : null}
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
      </FlowForm>
    );
  }

  return (
    <SitePage marketSlug={market?.slug} bar={false}>
      <StepShell
        n={n}
        total={STEPS.length}
        title={t(!urlService ? "picker.title" : (`${step}.title` as never))}
        back={backHref}
        error={error}
      >
        {body}
        <FunnelBeacon step={step} />
        <FlowTracker next={nextHref} />
      </StepShell>
    </SitePage>
  );
}
