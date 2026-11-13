"use server";

import { brand } from "@rsos/config/brand";
import { createPublicSupabase } from "@rsos/db/public";
import {
  chooseEmailSender,
  FormConfirmationEmail,
  formConfirmationSubject,
  TeamNoticeEmail,
  teamNoticeSubject,
} from "@rsos/emails";
import { type Locale, LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { cookies } from "next/headers";
import { z } from "zod";
import { guardForm } from "./forms";

export type ContactState = { ok?: boolean; error?: "required" | "turnstile" | "limit" | "generic" };

export const TOPICS = ["general", "job", "provider", "privacy", "other"] as const;

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.union([z.literal(""), z.string().regex(/^\+?1?\D*\d{3}\D*\d{3}\D*\d{4}$/)]),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(1).max(5000),
  market: z.string().max(80),
});

const toE164 = (raw: string) => {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `+1${d}` : null;
};

/** Contact form: validated, rate limited, Turnstile, stored, then the team and the sender are emailed. */
export async function submitContactAction(_: ContactState, form: FormData): Promise<ContactState> {
  const parsed = ContactSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone") ?? "",
    topic: form.get("topic") ?? "general",
    message: form.get("message"),
    market: form.get("market") ?? "",
  });
  if (!parsed.success) return { error: "required" };
  const guard = await guardForm(form, "contact", 5);
  if (guard !== "ok") return { error: guard };
  const supabase = createPublicSupabase();
  if (!supabase) return { error: "generic" };
  const d = parsed.data;
  const { error } = await supabase.rpc(
    "submit_contact_message" as never,
    {
      p: {
        name: d.name,
        email: d.email,
        phone: d.phone ? toE164(d.phone) : null,
        topic: d.topic,
        message: d.message,
        market_slug: d.market || null,
      },
    } as never,
  );
  if (error) return { error: "generic" };
  const locale: Locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const sender = chooseEmailSender();
  await Promise.allSettled([
    sender.send({
      to: brand.emails.support,
      subject: teamNoticeSubject("contact"),
      react: TeamNoticeEmail({
        kind: "contact",
        fields: [
          ["Name", d.name],
          ["Email", d.email],
          ["Phone", d.phone],
          ["Topic", d.topic],
          ["City", d.market],
          ["Message", d.message],
        ],
      }),
      tags: { category: "contact" },
    }),
    sender.send({
      to: d.email,
      subject: formConfirmationSubject("contact", locale),
      react: FormConfirmationEmail({ kind: "contact", name: d.name, locale }),
      tags: { category: "contact-confirmation" },
    }),
  ]);
  return { ok: true };
}
