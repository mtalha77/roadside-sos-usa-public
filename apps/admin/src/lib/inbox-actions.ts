"use server";

import { appUrl } from "@rsos/config/site";
import { chooseMaps, isPlausibleAddress } from "@rsos/core/adapters";
import {
  DriverUpdateEmail,
  type DriverUpdate,
  chooseEmailSender,
  driverUpdateSubject,
} from "@rsos/emails";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getInbox, type InboxItem } from "@/lib/inbox";
import { getServerSupabase } from "@/lib/supabase/server";
import { createLocationLink } from "@/lib/twilio/calls";

export type InboxActionState = {
  ok?: string;
  error?: string;
  /** No email on the request: the words for the dispatcher to read on the call. */
  readAloud?: {
    what: "assigned" | "locationLink";
    provider?: string;
    price?: string;
    eta?: number;
    link: string;
  };
};

const DISPATCH = new Set(["super_admin", "ops_manager", "dispatcher"]);
const Id = z.uuid();

async function dispatcher() {
  const ctx = await getAdminContext();
  return DISPATCH.has(ctx.role) ? ctx : null;
}

/** Live list refresh (Realtime tells the page something changed; this reloads it under RLS). */
export async function inboxItemsAction(): Promise<{
  items: InboxItem[];
  unread: number;
  unassigned: number;
}> {
  const ctx = await getAdminContext();
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  return getInbox(ids);
}

export async function claimAction(id: string, force = false): Promise<boolean> {
  if (!(await dispatcher()) || !Id.safeParse(id).success) return false;
  const { data } = await (
    await getServerSupabase()
  ).rpc("claim_request", {
    p_request_id: id,
    p_force: force,
  });
  revalidatePath("/inbox");
  return data === true;
}

/** One manual step (contacted, location confirmed, on the way, arrived, completed, or an end). */
export async function stepAction(_: InboxActionState, form: FormData): Promise<InboxActionState> {
  if (!(await dispatcher())) return { error: "forbidden" };
  const parsed = z
    .object({
      id: Id,
      status: z.enum([
        "contacted",
        "location_confirmed",
        "en_route",
        "on_site",
        "completed",
        "cancelled",
        "no_provider",
      ]),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse({
      id: form.get("id"),
      status: form.get("status"),
      reason: form.get("reason") || undefined,
    });
  if (!parsed.success) return { error: "invalid" };
  const { error } = await (
    await getServerSupabase()
  ).rpc("dispatch_step", {
    p_request_id: parsed.data.id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? undefined,
  });
  revalidatePath("/inbox");
  if (error)
    return {
      error: error.message.includes("reason")
        ? "reason"
        : error.message.includes("location")
          ? "location"
          : "step",
    };
  return { ok: parsed.data.status };
}

/** Phone intake: the dispatcher records name, service, address (geocoded), vehicle and notes. */
export async function intakeAction(_: InboxActionState, form: FormData): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx) return { error: "forbidden" };
  const parsed = z
    .object({
      id: Id,
      name: z.string().trim().min(1).max(120),
      service: Id,
      address: z.string().trim().min(3).max(300),
      vehicle: z.string().trim().max(120),
      notes: z.string().trim().max(2000),
    })
    .safeParse(
      Object.fromEntries(
        ["id", "name", "service", "address", "vehicle", "notes"].map((k) => [k, form.get(k) ?? ""]),
      ),
    );
  if (!parsed.success) return { error: "invalid" };
  // Typed address checked for format only (no geocoding while Google Maps is off).
  if (!isPlausibleAddress(parsed.data.address)) return { error: "address" };
  const supabase = await getServerSupabase();
  const { data: req } = await supabase
    .from("requests")
    .select("market_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!req) return { error: "invalid" };
  const market = ctx.markets.find((m) => m.id === req.market_id);
  const [{ data: ms }, { data: center }] = await Promise.all([
    supabase
      .from("current_market_services")
      .select("id, platform_fee_cents")
      .eq("market_id", req.market_id)
      .eq("service_id", parsed.data.service)
      .maybeSingle(),
    supabase.rpc("admin_market_shapes"),
  ]);
  if (!ms?.id) return { error: "service" };
  const c = (center ?? []).find((m) => m.slug === market?.slug);
  const place = await chooseMaps().geocode(
    parsed.data.address,
    c ? { lat: c.center_lat, lng: c.center_lng } : undefined,
  );
  if (!place) return { error: "address" };
  const { error } = await supabase
    .from("requests")
    .update({
      driver_name: parsed.data.name,
      service_id: parsed.data.service,
      market_service_id: ms.id,
      platform_fee_cents: ms.platform_fee_cents ?? 0,
      pickup_address: place.address,
      pickup_point: `SRID=4326;POINT(${place.lng} ${place.lat})`,
      vehicle_make: parsed.data.vehicle || null,
      notes: parsed.data.notes || null,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  revalidatePath("/inbox");
  return error ? { error: "generic" } : { ok: "saved" };
}

/** A provider call's outcome: no answer, declined, or a quote (price and ETA). */
export async function attemptAction(
  _: InboxActionState,
  form: FormData,
): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx) return { error: "forbidden" };
  const parsed = z
    .object({
      id: Id,
      provider: Id,
      outcome: z.enum(["no_answer", "declined", "quoted"]),
      price: z.coerce.number().min(0).max(10_000).optional(),
      eta: z.coerce.number().int().min(1).max(600).optional(),
    })
    .safeParse({
      id: form.get("id"),
      provider: form.get("provider"),
      outcome: form.get("outcome"),
      price: form.get("price") || undefined,
      eta: form.get("eta") || undefined,
    });
  if (!parsed.success) return { error: "invalid" };
  if (
    parsed.data.outcome === "quoted" &&
    (parsed.data.price === undefined || parsed.data.eta === undefined)
  )
    return { error: "quote" };
  const supabase = await getServerSupabase();
  const { data: req } = await supabase
    .from("requests")
    .select("market_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!req) return { error: "invalid" };
  const { error } = await supabase.from("dispatch_attempts").insert({
    request_id: parsed.data.id,
    provider_id: parsed.data.provider,
    market_id: req.market_id,
    staff_user_id: ctx.userId,
    outcome: parsed.data.outcome,
    quoted_price_cents:
      parsed.data.price !== undefined ? Math.round(parsed.data.price * 100) : null,
    quoted_eta_minutes: parsed.data.eta ?? null,
  });
  revalidatePath("/inbox");
  return error ? { error: "generic" } : { ok: parsed.data.outcome };
}

/**
 * Tells the driver (batch 4 scope change: no SMS): an email when the request has one, logged on
 * the timeline; otherwise nothing is sent and the panel shows the words to read on the call.
 */
async function tellDriver(
  requestId: string,
  staffUserId: string,
  update: DriverUpdate,
): Promise<"emailed" | "readAloud"> {
  const supabase = await getServerSupabase();
  const { data: req } = await supabase
    .from("requests")
    .select("driver_email")
    .eq("id", requestId)
    .maybeSingle();
  const to = req?.driver_email;
  if (!to) return "readAloud";
  const sent = await chooseEmailSender()
    .send({
      to,
      subject: driverUpdateSubject(update),
      react: DriverUpdateEmail(update),
      tags: { category: `driver_${update.kind}` },
    })
    .catch(() => null);
  if (!sent?.ok) return "readAloud";
  await supabase.from("request_events").insert({
    request_id: requestId,
    event_type: "driver_emailed",
    actor_type: "staff",
    actor_id: staffUserId,
    data: { what: update.kind },
  });
  return "emailed";
}

/** Assign the job: the step, the fee row (manual_test), and the driver told (email or call). */
export async function assignAction(_: InboxActionState, form: FormData): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx) return { error: "forbidden" };
  const parsed = z
    .object({
      id: Id,
      provider: Id,
      price: z.coerce.number().min(0).max(10_000),
      eta: z.coerce.number().int().min(1).max(600),
    })
    .safeParse({
      id: form.get("id"),
      provider: form.get("provider"),
      price: form.get("price"),
      eta: form.get("eta"),
    });
  if (!parsed.success) return { error: "invalid" };
  const supabase = await getServerSupabase();
  const cents = Math.round(parsed.data.price * 100);
  const { error } = await supabase.rpc("dispatch_step", {
    p_request_id: parsed.data.id,
    p_status: "assigned",
    p_provider_id: parsed.data.provider,
    p_price_cents: cents,
    p_eta_minutes: parsed.data.eta,
  });
  if (error) return { error: error.message.includes("location") ? "location" : "step" };
  const [{ data: req }, { data: provider }] = await Promise.all([
    supabase
      .from("requests")
      .select("driver_name, status_token")
      .eq("id", parsed.data.id)
      .maybeSingle(),
    supabase.from("providers").select("name").eq("id", parsed.data.provider).maybeSingle(),
  ]);
  revalidatePath("/inbox");
  if (!req || !provider) return { ok: "assigned" };
  const update = {
    kind: "assigned" as const,
    firstName: req.driver_name.split(" ")[0] ?? "",
    provider: provider.name,
    price: `$${parsed.data.price.toFixed(2)}`,
    eta: parsed.data.eta,
    link: `${appUrl("web")}/r/${req.status_token}`,
  };
  const how = await tellDriver(parsed.data.id, ctx.userId, update);
  return how === "emailed"
    ? { ok: "emailed" }
    : {
        ok: "assigned",
        readAloud: {
          what: "assigned",
          provider: update.provider,
          price: update.price,
          eta: update.eta,
          link: update.link,
        },
      };
}

/** A fresh location link (RSOS-023): emailed when there is an email, else read on the call. */
export async function locationLinkAction(id: string): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx || !Id.safeParse(id).success) return { error: "forbidden" };
  const link = await createLocationLink(id);
  if (!link) return { error: "generic" };
  const { data: req } = await (
    await getServerSupabase()
  )
    .from("requests")
    .select("driver_name")
    .eq("id", id)
    .maybeSingle();
  const how = await tellDriver(id, ctx.userId, {
    kind: "locationLink",
    firstName: req?.driver_name.split(" ")[0] ?? "",
    link,
  });
  revalidatePath("/inbox");
  return how === "emailed"
    ? { ok: "emailed" }
    : { ok: "link", readAloud: { what: "locationLink", link } };
}

/** The dispatcher read the words on the call: logged on the timeline. */
export async function toldDriverAction(id: string, what: string): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx || !Id.safeParse(id).success) return { error: "forbidden" };
  const parsed = z.enum(["assigned", "locationLink"]).safeParse(what);
  if (!parsed.success) return { error: "invalid" };
  const { error } = await (await getServerSupabase()).from("request_events").insert({
    request_id: id,
    event_type: "driver_told",
    actor_type: "staff",
    actor_id: ctx.userId,
    data: { what: parsed.data, channel: "call" },
  });
  revalidatePath("/inbox");
  return error ? { error: "generic" } : { ok: "logged" };
}

/** A note on the request timeline. */
export async function noteAction(_: InboxActionState, form: FormData): Promise<InboxActionState> {
  const ctx = await dispatcher();
  if (!ctx) return { error: "forbidden" };
  const parsed = z
    .object({ id: Id, note: z.string().trim().min(1).max(1000) })
    .safeParse({ id: form.get("id"), note: form.get("note") });
  if (!parsed.success) return { error: "invalid" };
  const { error } = await (await getServerSupabase()).from("request_events").insert({
    request_id: parsed.data.id,
    event_type: "note",
    actor_type: "staff",
    actor_id: ctx.userId,
    data: { note: parsed.data.note },
  });
  revalidatePath("/inbox");
  return error ? { error: "generic" } : { ok: "noted" };
}
