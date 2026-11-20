import { Badge } from "@rsos/ui/badge";
import { inputClass } from "@rsos/ui/input";
import { LiteMap } from "@rsos/ui/lite-map";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { FlagList } from "@/components/flags/flag-list";
import { CallButton } from "@/components/softphone/call-button";
import { RequestAnswers } from "@/components/requests/request-answers";
import { CLAIM_MINUTES, type InboxRequest, STEPS } from "@/lib/inbox";
import {
  AttemptForm,
  ClaimButton,
  IntakeForm,
  NoteForm,
  StepButtons,
  TellDriver,
} from "./panel-forms";

const card = "rounded-2xl border bg-card p-4";
const FLAG_RESOLVERS = ["super_admin", "ops_manager", "dispatcher", "support"];

/**
 * One request in the inbox (RSOS-034b): who and where, the full timeline, claim, the next manual
 * steps, intake details for phone requests, nearby providers to call and assign, and telling
 * the driver (email, or read on the call: no SMS in batch 4).
 */
/** A claim lapses after CLAIM_MINUTES without action (checked when the panel is rendered). */
function claimIsFresh(claimedAt: string | null): boolean {
  return claimedAt !== null && Date.now() - Date.parse(claimedAt) < CLAIM_MINUTES * 60_000;
}

export async function RequestPanel({
  data,
  userId,
  role,
}: {
  data: InboxRequest;
  userId: string;
  role: string;
}) {
  const tf = await getTranslations("admin.flags");
  const [t, ta, locale] = [
    await getTranslations("admin.inbox"),
    await getTranslations("admin.answers"),
    "en-US",
  ];
  const r = data.request;
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: (r.markets as { time_zone?: string } | null)?.time_zone ?? undefined,
  });
  const money = (c: number | null) =>
    c === null
      ? "—"
      : new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(c / 100);
  const fresh = Boolean(r.assigned_dispatcher_id && claimIsFresh(r.claimed_at));
  const mine = Boolean(fresh && r.assigned_dispatcher_id === userId);
  const closed = ["completed", "cancelled", "no_provider", "expired"].includes(r.status);
  const at = STEPS.indexOf(r.status as (typeof STEPS)[number]);
  const next = closed ? [] : STEPS.filter((s, i) => i > at && s !== "assigned").slice(0, 2);
  const service = r.services as { name?: string } | null;
  const vehicle = [r.vehicle_year, r.vehicle_color, r.vehicle_make, r.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const assigned = data.providers.find((p) => p.provider_id === r.assigned_provider_id);

  return (
    <article aria-labelledby="panel-h" className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 id="panel-h" className="font-mono text-xl font-semibold">
          {r.short_code}
        </h2>
        <Badge tone="info">{t(`status.${r.status}`)}</Badge>
        {r.urgent ? <Badge tone="critical">{t("urgent")}</Badge> : null}
        <Link href={`/requests/${r.id}`} className="ml-auto text-sm underline">
          {t("fullDetail")}
        </Link>
      </header>

      {/* Flags (owner decision 3) first: a safety report is the most urgent thing on the request. */}
      {data.flags.length ? (
        <FlagList
          flags={data.flags}
          back={`/inbox?id=${r.id}`}
          title={tf("title")}
          canResolve={FLAG_RESOLVERS.includes(role)}
        />
      ) : null}

      <section className={card} aria-labelledby="who-h">
        <h3 id="who-h" className="mb-2 font-semibold">
          {t("driver")}
        </h3>
        <p className="flex flex-wrap items-center gap-2">
          {r.driver_name} · <span className="font-mono">{r.driver_phone}</span>
          <CallButton
            label={t("callProvider")}
            call={{ to: r.driver_phone, requestId: r.id, label: r.driver_name }}
          />
        </p>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">{t("service")}</dt>
          <dd>{service?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">{t("location")}</dt>
          <dd>{r.pickup_address ?? t("noLocation")}</dd>
          <dt className="text-muted-foreground">{t("vehicle")}</dt>
          <dd>{vehicle || "—"}</dd>
          {/* RSOS-116: the customer's answers for this service, as short tags and in full. */}
          <dt className="text-muted-foreground">{ta("title")}</dt>
          <dd>
            <RequestAnswers
              service={(r.services as { slug?: string } | null)?.slug ?? ""}
              stored={r.service_answers}
              photos={r.photo_paths ?? []}
              scheduledFor={r.scheduled_for}
              timeZone={(r.markets as { time_zone?: string } | null)?.time_zone}
            />
          </dd>
          <dt className="text-muted-foreground">{t("notes")}</dt>
          <dd>{r.notes ?? r.pickup_note ?? "—"}</dd>
          <dt className="text-muted-foreground">{t("source")}</dt>
          <dd>{r.source ?? r.channel}</dd>
        </dl>
        {data.point ? (
          <LiteMap
            className="mt-3"
            label={t("map")}
            points={[{ id: "req", kind: "request", ...data.point, label: r.driver_name }]}
          />
        ) : null}
      </section>

      <section className={card} aria-labelledby="own-h">
        <h3 id="own-h" className="mb-2 font-semibold">
          {t("handling")}
        </h3>
        <p className="mb-2 text-sm text-muted-foreground">
          {fresh && data.owner ? t("owner", { name: data.owner }) : t("unclaimed")}
        </p>
        {!closed ? <ClaimButton id={r.id} mine={mine} owner={fresh ? data.owner : null} /> : null}
        {!closed ? (
          <div className="mt-3">
            <StepButtons id={r.id} next={next} inputClass={inputClass} />
          </div>
        ) : (
          <p className="text-sm">
            {r.end_reason ? t("endReason", { reason: r.end_reason }) : null}
          </p>
        )}
      </section>

      {!closed && at < STEPS.indexOf("assigned") ? (
        <section className={card} aria-labelledby="intake-h">
          <h3 id="intake-h" className="mb-2 font-semibold">
            {t("intakeTitle")}
          </h3>
          <IntakeForm
            id={r.id}
            name={r.driver_name}
            address={r.pickup_address ?? ""}
            serviceId={r.service_id}
            services={data.services}
            notes={r.notes ?? ""}
            vehicle={r.vehicle_make ?? ""}
            inputClass={inputClass}
          />
        </section>
      ) : null}

      <section className={card} aria-labelledby="prov-h">
        <h3 id="prov-h" className="mb-2 font-semibold">
          {t("providersTitle")}
        </h3>
        {r.assigned_provider_id ? (
          <p className="mb-2 text-sm font-medium">
            {t("assignedTo", {
              name: assigned?.name ?? "",
              price: money(r.quoted_price_cents),
              eta: r.quoted_eta_minutes ?? 0,
            })}
          </p>
        ) : null}
        {data.providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noProviders")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.providers.map((p) => {
              const tries = data.attempts.filter((a) => a.provider_id === p.provider_id);
              return (
                <li key={p.provider_id} className="flex flex-col gap-2 rounded-xl border p-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.distance_miles !== null ? (
                      <Badge tone={p.in_radius === false ? "warning" : "neutral"}>
                        {t("miles", { miles: Number(p.distance_miles) })}
                      </Badge>
                    ) : null}
                    <span className="text-sm text-muted-foreground">
                      {t("priceFrom", { price: money(p.price_cents) })}
                    </span>
                    {p.last_response_sec !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {t("responds", { sec: p.last_response_sec })}
                      </span>
                    ) : null}
                    {p.acceptance_rate !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {t("accepts", { pct: Math.round(Number(p.acceptance_rate) * 100) })}
                      </span>
                    ) : null}
                    {p.dispatch_phone ? (
                      <CallButton
                        label={t("callProvider")}
                        call={{ to: p.dispatch_phone, requestId: r.id, label: p.name }}
                      />
                    ) : null}
                  </p>
                  {tries.length ? (
                    <p className="text-sm text-muted-foreground">
                      {tries.map((a) => t(`outcome.${a.outcome}`)).join(" · ")}
                    </p>
                  ) : null}
                  {!closed && !r.assigned_provider_id ? (
                    <AttemptForm id={r.id} provider={p.provider_id} inputClass={inputClass} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="tell-h">
        <h3 id="tell-h" className="mb-2 font-semibold">
          {t("tell.title")}
        </h3>
        {!closed ? <TellDriver id={r.id} email={r.driver_email ?? null} /> : null}
      </section>

      <section className={card} aria-labelledby="tl-h">
        <h3 id="tl-h" className="mb-2 font-semibold">
          {t("timeline")}
        </h3>
        <ol className="mb-3 flex flex-col gap-1 text-sm">
          {data.timeline.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                {time.format(e.at)}
              </span>
              <span>
                {e.kind === "event"
                  ? e.label.startsWith("status:")
                    ? t("tl.status", { status: t(`status.${e.label.slice(7)}`) })
                    : t.has(`tl.${e.label}`)
                      ? t(`tl.${e.label}`)
                      : e.label
                  : e.kind === "call"
                    ? t("tl.call_inbound", { outcome: t(`call.${e.label}`) })
                    : t(`tl.text_${e.direction}`)}
                {e.detail && e.kind !== "text" ? ` · ${e.detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
        {!closed ? <NoteForm id={r.id} inputClass={inputClass} /> : null}
      </section>
    </article>
  );
}
