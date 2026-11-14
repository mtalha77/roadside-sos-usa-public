import { brand } from "@rsos/config/brand";
import { serviceIcons, type ServiceIconKey } from "@rsos/ui/icons";
import { inputClass } from "@rsos/ui/input";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { Choice } from "@/components/get-help/choice";
import { LocateButton } from "@/components/get-help/locate-button";
import { StepShell } from "@/components/get-help/step-shell";
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
  previousStep,
  stepsFor,
  VEHICLE_MAKES,
  VEHICLE_TYPES,
} from "@/lib/get-help";
import { cityLabel, formatPhone } from "@/lib/market";
import { pageMetadata } from "@/lib/seo";
import { getMarkets, getMarketServices } from "@/lib/site-data";
import { ui } from "@/lib/ui-classes";
import { getVisitorMarket } from "@/lib/visitor";
import { createPublicSupabase } from "@rsos/db/public";

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

/**
 * Get Help (RSOS-021): one question per screen, saved to a draft after every step, so a reload or
 * a lost connection resumes where the driver was. Plain forms: works without JavaScript and stays
 * inside the 150 KB budget; only "Use my location" and the final security check use script.
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
  const step = allowedStep(draft, sp.step);
  const order = stepsFor(draft);
  const n = order.indexOf(step) + 1;
  const back = previousStep(draft, step);
  const backHref = back ? `/get-help?step=${back}` : null;
  const error = sp.error ?? null;
  const market =
    markets.find(
      (m) =>
        m.slug ===
        (draft.market ?? (detection.kind === "market" ? detection.market.slug : undefined)),
    ) ?? null;
  const services = market ? (await getMarketServices(market.slug)).filter((s) => s.enabled) : [];
  const hidden = (name: string, value: string | number | undefined | null) =>
    value === undefined || value === null ? null : (
      <input type="hidden" name={name} value={String(value)} />
    );
  const label = "flex flex-col gap-2 font-medium";
  const fieldset = "flex flex-col gap-3";

  let body;
  if (step === "location") {
    body = sp.outside ? (
      <OutsideArea city={null} region={null} markets={markets} />
    ) : (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "location")}
        <input type="hidden" name="lat" defaultValue="" />
        <input type="hidden" name="lng" defaultValue="" />
        {hidden(
          "service",
          sp.service && /^[a-z-]{2,40}$/.test(sp.service) ? sp.service : undefined,
        )}
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
        <LocateButton
          label={t("location.useMine")}
          busyLabel={t("location.locating")}
          deniedLabel={t("location.denied")}
          fallbackId="gh-address"
        />
        <p className="text-sm font-medium text-muted-foreground">{t("location.or")}</p>
        <label className={label}>
          {t("location.address")}
          <input
            id="gh-address"
            name="address"
            defaultValue={draft.approx ? draft.address : ""}
            autoComplete="street-address"
            className={inputClass}
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
        <button type="submit" className={`${ui.button.outline} self-start`}>
          {t("next")}
        </button>
      </form>
    );
  } else if (step === "problem") {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "problem")}
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">{t("problem.title")}</legend>
          {services.map((s) => {
            const Glyph = serviceIcons[s.icon_key as ServiceIconKey];
            return (
              <label
                key={s.service_slug}
                className="flex min-h-28 cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 border-border bg-surface p-4 has-[:checked]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  id={`svc-${s.service_slug}`}
                  type="radio"
                  name="service"
                  value={s.service_slug}
                  defaultChecked={draft.service === s.service_slug}
                  required
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-xl bg-muted [&_svg]:size-6"
                >
                  {Glyph ? <Glyph /> : null}
                </span>
                <span className="text-lg font-semibold">
                  {serviceName(ts, { slug: s.service_slug, name: s.service_name })}
                </span>
              </label>
            );
          })}
        </fieldset>
        {Object.entries(FOLLOW_UPS).map(([slug, fu]) => (
          <fieldset
            key={slug}
            className={`${fieldset} hidden [form:has(#svc-${slug}:checked)_&]:flex`}
          >
            <legend className="mb-1 font-semibold">{t(`problem.${fu.key}.q` as never)}</legend>
            {fu.options.map((o) => (
              <Choice
                key={o}
                name={`followUp-${slug}`}
                value={o}
                checked={draft.service === slug && draft.followUp === o}
              >
                {t(`problem.${fu.key}.${o}` as never)}
              </Choice>
            ))}
          </fieldset>
        ))}
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("next")}
        </button>
      </form>
    );
  } else if (step === "destination") {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "destination")}
        <label className={label}>
          {t("destination.address")}
          <input
            name="destAddress"
            required
            defaultValue={draft.destAddress ?? ""}
            className={inputClass}
          />
        </label>
        <fieldset className={fieldset}>
          <legend className="mb-1 font-semibold">{t("destination.miles")}</legend>
          {Object.keys(MILE_RANGES).map((k) => (
            <Choice key={k} name="destMiles" value={k} checked={draft.destMiles === k}>
              {t(`destination.ranges.${k}` as never)}
            </Choice>
          ))}
        </fieldset>
        <p className="text-sm text-muted-foreground">{t("destination.note")}</p>
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("next")}
        </button>
      </form>
    );
  } else if (step === "vehicle") {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "vehicle")}
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="mb-1 font-semibold">{t("vehicle.type")}</legend>
          {VEHICLE_TYPES.map((v) => (
            <Choice
              key={v}
              name="vehicleType"
              value={v}
              checked={(draft.vehicleType ?? "car") === v}
            >
              {t(`vehicle.types.${v}` as never)}
            </Choice>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
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
            {t("vehicle.model")}
            <input name="model" defaultValue={draft.model ?? ""} className={inputClass} />
          </label>
          <label className={label}>
            {t("vehicle.color")}
            <select name="color" defaultValue={draft.color ?? "White"} className={inputClass}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("vehicle.year")}
            <input
              name="year"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              defaultValue={draft.year ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex min-h-touch items-center gap-3 font-medium">
          <input
            type="checkbox"
            name="ev"
            defaultChecked={draft.ev}
            className="size-5 accent-[var(--primary)]"
          />
          {t("vehicle.ev")}
        </label>
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("next")}
        </button>
      </form>
    );
  } else if (step === "safety") {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "safety")}
        <fieldset className={fieldset}>
          <legend className="mb-1 font-semibold">{t("safety.safe")}</legend>
          <Choice name="safe" value="yes" checked={draft.safe === true}>
            {t("safety.yes")}
          </Choice>
          <Choice name="safe" value="no" id="gh-unsafe" checked={draft.safe === false}>
            {t("safety.no")}
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
        <fieldset className={fieldset}>
          <legend className="mb-1 font-semibold">{t("safety.highway")}</legend>
          <Choice name="highway" value="yes" checked={draft.highway === true}>
            {t("safety.yes")}
          </Choice>
          <Choice name="highway" value="no" checked={draft.highway === false}>
            {t("safety.no")}
          </Choice>
        </fieldset>
        <label className={label}>
          {t("safety.passengers")}
          <select
            name="passengers"
            defaultValue={String(draft.passengers ?? 0)}
            className={inputClass}
          >
            {[0, 1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("next")}
        </button>
      </form>
    );
  } else if (step === "contact") {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "contact")}
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
        <p className="text-sm text-muted-foreground">
          {t.rich("contact.consent", {
            terms: () => (
              <Link className="underline underline-offset-4" href="/legal/driver-terms">
                {t("contact.terms")}
              </Link>
            ),
            privacy: () => (
              <Link className="underline underline-offset-4" href="/legal/privacy">
                {t("contact.privacy")}
              </Link>
            ),
          })}
        </p>
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("contact.sendCode")}
        </button>
      </form>
    );
  } else {
    body = (
      <form method="post" action="/api/get-help" className="flex flex-col gap-5">
        {hidden("step", "verify")}
        {draft.smsAvailable ? (
          <>
            <p>{t("verify.body", { phone: formatPhone(draft.phone ?? "") })}</p>
            {draft.demoCode ? (
              <p className="rounded-xl bg-warning-subtle p-3 text-sm font-medium text-warning-strong">
                {t("verify.demoCode", { code: draft.demoCode })}
              </p>
            ) : null}
            <label className={label}>
              {t("verify.code")}
              <input
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                className={`${inputClass} text-2xl tracking-[0.5em] tabular-nums`}
              />
            </label>
          </>
        ) : (
          <p>{t("verify.noSms")}</p>
        )}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
          <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} label={brand.name} />
        ) : null}
        <button type="submit" className={`${ui.button.primary} self-start`}>
          {t("verify.submit")}
        </button>
        <Link
          className="inline-flex min-h-touch items-center self-start underline underline-offset-4"
          href="/get-help?step=contact"
        >
          {t("verify.resend")}
        </Link>
      </form>
    );
  }

  return (
    <SitePage marketSlug={market?.slug}>
      <StepShell
        n={n}
        total={order.length}
        title={t(`${step}.title` as never)}
        back={backHref}
        error={error}
      >
        {body}
      </StepShell>
    </SitePage>
  );
}
