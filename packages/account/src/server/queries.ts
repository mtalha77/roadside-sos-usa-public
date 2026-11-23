import "server-only";
import { getAccountSupabase } from "./client";

export type SecondStepMethod = "email" | "sms" | "totp";

/** Everything the account page shows, read with the user's own session (RLS and definer functions). */
export async function loadAccount() {
  const supabase = await getAccountSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const [settings, sessions, devices, events, factors] = await Promise.all([
    supabase.from("user_security_settings").select("second_step_method").maybeSingle(),
    supabase.rpc("my_sessions"),
    supabase
      .from("trusted_devices")
      .select("id, user_agent, created_at, expires_at")
      .order("created_at", { ascending: false }),
    supabase.rpc("my_security_events", { p_limit: 30 }),
    supabase.auth.mfa.listFactors(),
  ]);
  return {
    user: {
      email: user.email ?? "",
      newEmail: user.new_email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? "",
      phone: user.phone ? `+${user.phone.replace(/^\+/, "")}` : null,
      phoneConfirmed: Boolean(user.phone_confirmed_at),
    },
    method: (settings.data?.second_step_method ?? "email") as SecondStepMethod,
    hasTotp: Boolean(factors.data?.totp.some((f) => f.status === "verified")),
    sessions: sessions.data ?? [],
    devices: devices.data ?? [],
    events: events.data ?? [],
  };
}

export type AccountData = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

/** The provider's status for the paused/suspended/closed screen. */
export async function loadProviderStatus() {
  const supabase = await getAccountSupabase();
  const { data } = await supabase.rpc("my_provider_status");
  return (data ?? [])[0] ?? null;
}

/** Second-step method of the signed-in user, plus their email (for the code screen). */
export async function loadSecondStepContext() {
  const supabase = await getAccountSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const [{ data: settings }, { data: factors }] = await Promise.all([
    supabase.from("user_security_settings").select("second_step_method").maybeSingle(),
    supabase.auth.mfa.listFactors(),
  ]);
  const hasTotp = Boolean(factors?.totp.some((f) => f.status === "verified"));
  const method = (settings?.second_step_method ?? "email") as SecondStepMethod;
  // SMS needs Twilio (owner blocker); until then SMS users get the emailed code.
  return {
    email: auth.user.email ?? "",
    method: method === "totp" && hasTotp ? "totp" : "email",
  } as const;
}
