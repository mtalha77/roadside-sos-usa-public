"use server";

import { brand } from "@rsos/config/brand";
import { legalDocuments } from "@rsos/config/legal";
import { chooseSmsSender } from "@rsos/core";
import { createPublicSupabase } from "@rsos/db/public";
import {
  chooseEmailSender,
  FormConfirmationEmail,
  formConfirmationSubject,
  TeamNoticeEmail,
  teamNoticeSubject,
} from "@rsos/emails";
import { fill, getMessages, type Locale, LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { callerIp, guardForm } from "./forms";

export type ApplyState = {
  ok?: boolean;
  error?: "required" | "turnstile" | "limit" | "generic";
  fields?: string[];
};

const toE164 = (raw: unknown) => {
  const d = String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `+1${d}` : "";
};

const ApplySchema = z.object({
  company_name: z.string().trim().min(2).max(160),
  contact_name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/),
  email: z.email().max(254),
  market_slugs: z.array(z.string().max(80)).min(1).max(20),
  service_slugs: z.array(z.string().max(80)).min(1).max(20),
  truck_count: z.coerce.number().int().min(1).max(1000),
  insurance_carrier: z.string().trim().min(2).max(160),
  license_number: z.string().trim().max(60),
  referral_source: z.string().trim().max(160),
  sms_consent: z.boolean(),
});

/**
 * Provider application: validated, rate limited, Turnstile, stored with its markets (and the SMS
 * opt-in as a consent with the terms version), then the team is notified and the applicant gets
 * a confirmation by email and, if they opted in, by text (mock until Twilio is set up).
 */
export async function submitApplicationAction(_: ApplyState, form: FormData): Promise<ApplyState> {
  const parsed = ApplySchema.safeParse({
    company_name: form.get("company_name"),
    contact_name: form.get("contact_name"),
    phone: toE164(form.get("phone")),
    email: form.get("email"),
    market_slugs: form.getAll("markets"),
    service_slugs: form.getAll("services"),
    truck_count: form.get("truck_count"),
    insurance_carrier: form.get("insurance_carrier"),
    license_number: form.get("license_number") ?? "",
    referral_source: form.get("referral_source") ?? "",
    sms_consent: form.get("sms_consent") === "on",
  });
  if (!parsed.success)
    return {
      error: "required",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  const guard = await guardForm(form, "apply", 3);
  if (guard !== "ok") return { error: guard };
  const supabase = createPublicSupabase();
  if (!supabase) return { error: "generic" };
  const d = parsed.data;
  const { error } = await supabase.rpc(
    "submit_provider_application" as never,
    {
      p: {
        ...d,
        truck_count: String(d.truck_count),
        sms_policy_version: legalDocuments["sms-terms"].version,
        ip: await callerIp(),
        user_agent: (await headers()).get("user-agent") ?? "",
      },
    } as never,
  );
  if (error) return { error: "generic" };
  const locale: Locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const email = chooseEmailSender();
  await Promise.allSettled([
    email.send({
      to: brand.emails.support,
      subject: teamNoticeSubject("provider_application"),
      react: TeamNoticeEmail({
        kind: "provider_application",
        fields: [
          ["Company", d.company_name],
          ["Contact", d.contact_name],
          ["Phone", d.phone],
          ["Email", d.email],
          ["Cities", d.market_slugs.join(", ")],
          ["Services", d.service_slugs.join(", ")],
          ["Trucks", String(d.truck_count)],
          ["Insurance", d.insurance_carrier],
          ["License", d.license_number],
          ["Heard about us", d.referral_source],
          ["SMS opt-in", d.sms_consent ? "yes" : "no"],
        ],
      }),
      tags: { category: "provider-application" },
    }),
    email.send({
      to: d.email,
      subject: formConfirmationSubject("provider_application", locale),
      react: FormConfirmationEmail({ kind: "provider_application", name: d.contact_name, locale }),
      tags: { category: "provider-application-confirmation" },
    }),
    d.sms_consent
      ? chooseSmsSender().send(
          d.phone,
          fill(getMessages(locale).forProviders.smsConfirmation, {
            brand: brand.shortName,
            company: d.company_name,
          }),
        )
      : Promise.resolve(null),
  ]);
  return { ok: true };
}
