import { z } from "zod";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const VerifyResponseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "not-configured" | "invalid" | "unavailable" };

export type TurnstileOptions = {
  /** Server secret. Defaults to TURNSTILE_SECRET_KEY. */
  secret?: string;
  remoteIp?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Verifies a Cloudflare Turnstile token on the server. Fails CLOSED: a missing token, a
 * missing secret, an invalid token or an unreachable Cloudflare all reject the request.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  options: TurnstileOptions = {},
): Promise<TurnstileResult> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!token) return { ok: false, reason: "missing-token" };
  if (!secret) return { ok: false, reason: "not-configured" };

  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp) body.set("remoteip", options.remoteIp);

  try {
    const res = await (options.fetchImpl ?? fetch)(VERIFY_URL, { method: "POST", body });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const parsed = VerifyResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, reason: "unavailable" };
    return parsed.data.success ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
