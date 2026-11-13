import "server-only";
import { choosePhoneVerifier, type PhoneVerifier } from "@rsos/core";
import { getSiteEnv } from "@rsos/config/site";
import type { getServerSupabase } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof getServerSupabase>>;

/** SMS through Supabase phone auth (Twilio Verify configured in Supabase). */
function supabaseSms(supabase: Supabase): PhoneVerifier {
  return {
    kind: "sms",
    async start(phone) {
      const { error } = await supabase.auth.updateUser({ phone });
      return error ? { ok: false, reason: "error" } : { ok: true };
    },
    async check(phone, code) {
      const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
      return error ? { ok: false, reason: "invalid-code" } : { ok: true };
    },
  };
}

/** Real SMS when SUPABASE_SMS_ENABLED=true; the mock only on development and previews. */
export function phoneVerifier(supabase: Supabase): PhoneVerifier {
  return choosePhoneVerifier({
    siteEnv: getSiteEnv(),
    smsEnabled: process.env.SUPABASE_SMS_ENABLED === "true",
    sms: supabaseSms(supabase),
  });
}

/** Phone verified for real, or (mock environments only) through the mock flow. */
export function isPhoneVerified(
  user: { phone_confirmed_at?: string | null; user_metadata?: Record<string, unknown> },
  verifierKind: PhoneVerifier["kind"],
) {
  if (user.phone_confirmed_at) return true;
  return verifierKind === "mock" && typeof user.user_metadata?.phone_verified_mock === "string";
}
