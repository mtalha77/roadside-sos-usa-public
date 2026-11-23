/**
 * Phone verification by SMS code, behind one interface:
 * - Supabase phone auth (Twilio Verify configured in Supabase) when SMS is set up,
 * - a mock for development and previews (accepts the code 000000, sends nothing),
 * - "unavailable" everywhere else, so production never silently skips verification.
 */
export type VerificationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid-code" | "expired" | "too-many-attempts" | "unavailable" | "error";
    };

export interface PhoneVerifier {
  readonly kind: "sms" | "mock" | "unavailable";
  /** Sends a 6-digit code to the E.164 number. */
  start(phone: string): Promise<VerificationResult>;
  check(phone: string, code: string): Promise<VerificationResult>;
}

export const MOCK_CODE = "000000";

export function createMockPhoneVerifier(): PhoneVerifier {
  const started = new Set<string>();
  return {
    kind: "mock",
    async start(phone) {
      started.add(phone);
      return { ok: true };
    },
    async check(phone, code) {
      if (!started.has(phone)) return { ok: false, reason: "expired" };
      return code === MOCK_CODE ? { ok: true } : { ok: false, reason: "invalid-code" };
    },
  };
}

export const unavailablePhoneVerifier: PhoneVerifier = {
  kind: "unavailable",
  start: async () => ({ ok: false, reason: "unavailable" }),
  check: async () => ({ ok: false, reason: "unavailable" }),
};

/**
 * Chooses the verifier: real SMS when `smsEnabled` (Twilio configured in Supabase), the mock only in
 * development and preview, otherwise unavailable.
 */
export function choosePhoneVerifier(opts: {
  siteEnv: string;
  smsEnabled: boolean;
  sms?: PhoneVerifier;
}): PhoneVerifier {
  if (opts.smsEnabled && opts.sms) return opts.sms;
  if (opts.siteEnv === "development" || opts.siteEnv === "preview")
    return createMockPhoneVerifier();
  return unavailablePhoneVerifier;
}
