import "server-only";
import {
  chooseEmailSender,
  type SecurityEvent,
  SecurityNoticeEmail,
  securityNoticeSubject,
} from "@rsos/emails";
import { LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { cookies } from "next/headers";
import type { getAccountSupabase } from "./client";
import { when } from "../components/when";
import { requestMeta } from "./client";

type Supabase = Awaited<ReturnType<typeof getAccountSupabase>>;

/** Audit action names for each notice. */
export const AUDIT_ACTION: Record<SecurityEvent, string> = {
  new_sign_in: "auth.sign_in",
  password_changed: "auth.password_changed",
  email_changed: "auth.email_change_requested",
  phone_changed: "auth.phone_changed",
  second_step_changed: "auth.second_step_method_changed",
  recovery_codes: "auth.recovery_codes_generated",
  session_revoked: "auth.session_revoked",
  closure_requested: "account.closure_requested",
};

/**
 * Every security change: (1) an audit log row, unless the database function already wrote one,
 * and (2) a notice through the email interface (Resend, the mock on previews, or recorded as not sent).
 */
export async function recordSecurityEvent(
  supabase: Supabase,
  event: SecurityEvent,
  opts: { alreadyAudited?: boolean } = {},
) {
  const { ip, userAgent } = await requestMeta();
  if (!opts.alreadyAudited) {
    await supabase.rpc("log_security_event", {
      p_action: AUDIT_ACTION[event],
      p_data: { user_agent: userAgent.slice(0, 160) },
      p_ip: ip ?? "",
    });
  }
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return { emailed: false };
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email;
  const time = when(new Date().toISOString(), locale);
  const result = await chooseEmailSender().send({
    to: user.email,
    subject: securityNoticeSubject(event, locale),
    react: SecurityNoticeEmail({ event, name, time, device: userAgent.slice(0, 120), locale }),
    tags: { category: "security", event },
  });
  return { emailed: result.ok };
}
