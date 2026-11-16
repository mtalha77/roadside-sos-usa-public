import { DEMO_SERVICES } from "@rsos/core/demo";
import { getTranslations } from "next-intl/server";
import { IntakeConsole } from "@/components/intake/intake-console";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { listRequests } from "@/lib/requests";

export const dynamic = "force-dynamic";

async function load() {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const history = await listRequests({ q: "", markets: ctx.selected, demo: ctx.demo, now });
  return { ctx, history: history.slice(0, 40) };
}

/**
 * Phone intake console (RSOS-074): softphone panel (answer, hold, transfer, mute, availability) as
 * UI with a demo incoming call, screen pop with the caller's history, a guided intake form and a
 * "send location link" button. Calls need phone service (Twilio), so the softphone is simulated.
 */
export default async function IntakePage() {
  const [t, ts, { ctx, history }] = await Promise.all([
    getTranslations("admin.intake"),
    getTranslations("site.services"),
    load(),
  ]);
  const caller = history[0];
  const keys = [
    "title",
    "softphone",
    "available",
    "away",
    "incoming",
    "answer",
    "decline",
    "hold",
    "resume",
    "mute",
    "unmute",
    "transfer",
    "hangUp",
    "onCall",
    "idle",
    "simulate",
    "screenPop",
    "history",
    "noHistory",
    "form",
    "name",
    "phone",
    "market",
    "service",
    "location",
    "locationHint",
    "sendLink",
    "linkSent",
    "vehicle",
    "safety",
    "safe",
    "unsafe",
    "highway",
    "create",
    "created",
    "required",
    "timer",
    "startCall",
  ] as const;
  return (
    <IntakeConsole
      demo={ctx.demo}
      caller={{
        name: caller?.driver ?? "",
        phone: caller?.phone ?? "",
      }}
      history={history
        .filter((h) => caller && h.phone === caller.phone)
        .map((h) => ({ code: h.code, id: h.id, status: h.status, at: h.createdAt }))}
      markets={ctx.markets
        .filter((m) => ctx.selected.includes(m.slug))
        .map((m) => ({ slug: m.slug, name: m.name }))}
      services={DEMO_SERVICES.map((s) => ({
        slug: s,
        name: ts.has(`${s}.name`) ? ts(`${s}.name`) : s,
      }))}
      labels={Object.fromEntries(keys.map((k) => [k, String(t.raw(k))]))}
    />
  );
}
