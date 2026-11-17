import { createHash, randomInt } from "node:crypto";
import { isDemoMode } from "@rsos/config/demo";
import { demoDriverProfile } from "@rsos/core/demo";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  demoPhoneFor,
  DRIVER_COOKIE,
  type DriverSession,
  readDriverSession,
} from "@/lib/driver-account";
import { DRAFT_COOKIE } from "@/lib/get-help";

const hash = (code: string, email: string) =>
  createHash("sha256").update(`${email}:${code}`).digest("hex");

/**
 * Driver account actions (RSOS-070, demo mode only): email-code sign-in (no SMS; the code is
 * shown on screen, nothing is sent), removing saved items, deleting the account, and a quick repeat request that pre-fills
 * the Get Help draft with the saved vehicle and number.
 */
export async function POST(request: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const session = readDriverSession(request.cookies.get(DRIVER_COOKIE)?.value);
  const go = (to: string, next?: DriverSession | null) => {
    const res = NextResponse.redirect(new URL(to, request.url), 303);
    const secure = request.nextUrl.protocol === "https:";
    if (next === null) res.cookies.delete(DRIVER_COOKIE);
    else if (next)
      res.cookies.set(DRIVER_COOKIE, JSON.stringify(next), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 30 * 86_400,
      });
    return res;
  };
  if (action === "send-code") {
    const email = z
      .email()
      .max(254)
      .safeParse(
        String(form.get("email") ?? "")
          .trim()
          .toLowerCase(),
      );
    if (!email.success) return go("/account?error=email");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    return go(`/account?code=${code}`, {
      email: email.data,
      phone: demoPhoneFor(email.data),
      pendingCodeHash: hash(code, email.data),
      signedIn: false,
      removedVehicles: [],
      removedPlaces: [],
      removedFavorites: [],
    });
  }
  if (action === "verify") {
    if (
      !session?.pendingCodeHash ||
      hash(String(form.get("code") ?? ""), session.email) !== session.pendingCodeHash
    )
      return go("/account?error=code");
    return go("/account", { ...session, pendingCodeHash: undefined, signedIn: true });
  }
  if (!session?.signedIn) return go("/account");
  const id = String(form.get("id") ?? "");
  switch (action) {
    case "remove-vehicle":
      return go("/account?tab=vehicles", {
        ...session,
        removedVehicles: [...session.removedVehicles, id],
      });
    case "default-vehicle":
      return go("/account?tab=vehicles", { ...session, defaultVehicle: id });
    case "remove-place":
      return go("/account?tab=places", {
        ...session,
        removedPlaces: [...session.removedPlaces, id],
      });
    case "remove-favorite":
      return go("/account?tab=favorites", {
        ...session,
        removedFavorites: [...session.removedFavorites, id],
      });
    case "delete":
      return String(form.get("confirm")) === "DELETE"
        ? go("/?deleted=1", null)
        : go("/account?tab=settings&error=confirm");
    case "sign-out":
      return go("/", null);
    case "quick": {
      // Saved vehicle and number go into a new Get Help draft; the driver confirms location, safety and sends.
      const profile = demoDriverProfile(session.email || session.phone);
      const vehicle =
        profile.vehicles.find((v) => v.id === (session.defaultVehicle ?? "v0")) ??
        profile.vehicles[0]!;
      const service = String(form.get("service") ?? "flat-tire").slice(0, 40);
      const supabase = createPublicSupabase();
      if (!supabase) return go("/get-help");
      const { data } = await (
        supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
      )("save_request_draft", {
        p_token: null,
        p_patch: {
          service,
          followUp: service === "flat-tire" ? "yes" : "",
          vehicleType: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          year: vehicle.year,
          ev: false,
          name: "Demo driver",
          phone: session.phone,
          codeSent: false,
          quick: true,
        },
      });
      const res = go("/get-help?step=location");
      res.cookies.set(DRAFT_COOKIE, String(data), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: 86_400,
      });
      return res;
    }
    default:
      return go("/account");
  }
}
