"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input, inputClass, Textarea } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type ContactState, submitContactAction } from "@/lib/contact-action";
import { Turnstile } from "./turnstile";

type Props = {
  topics: readonly string[];
  markets: { slug: string; label: string }[];
  currentMarket: string | null;
  siteKey: string | null;
};

export function ContactForm({ topics, markets, currentMarket, siteKey }: Props) {
  const t = useTranslations("pages.contact");
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContactAction, {});
  if (state.ok) return <Alert tone="success" title={t("sent")} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} required>
          {({ id }) => <Input id={id} name="name" autoComplete="name" required maxLength={120} />}
        </Field>
        <Field label={t("email")} required>
          {({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field label={t("phone")}>
          {({ id }) => <Input id={id} name="phone" type="tel" autoComplete="tel" inputMode="tel" />}
        </Field>
        <Field label={t("topic")}>
          {({ id }) => (
            <select id={id} name="topic" defaultValue="general" className={inputClass}>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`topics.${tp}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("market")} className="sm:col-span-2">
          {({ id }) => (
            <select id={id} name="market" defaultValue={currentMarket ?? ""} className={inputClass}>
              <option value="">{"—"}</option>
              {markets.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label={t("message")} required>
        {({ id }) => <Textarea id={id} name="message" rows={6} required maxLength={5000} />}
      </Field>
      {siteKey ? <Turnstile siteKey={siteKey} label={t("verify")} /> : null}
      <Button type="submit" loading={pending} className="self-start">
        {t("send")}
      </Button>
    </form>
  );
}
