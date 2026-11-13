"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { type ApplyState, submitApplicationAction } from "@/lib/apply-action";
import { Turnstile } from "./turnstile";

type Option = { value: string; label: string };

function Choices({
  legend,
  name,
  options,
  invalid,
}: {
  legend: string;
  name: string;
  options: Option[];
  invalid: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={invalid || undefined}>
      <legend className="mb-1 font-medium">
        {legend}
        <span className="text-critical-strong">{" *"}</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border px-3 has-[:checked]:border-primary"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              className="size-5 accent-[var(--primary)]"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ApplyForm({
  markets,
  services,
  siteKey,
}: {
  markets: Option[];
  services: Option[];
  siteKey: string | null;
}) {
  const t = useTranslations("forProviders.form");
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    submitApplicationAction,
    {},
  );
  if (state.ok) return <Alert tone="success" title={t("sent")} />;
  const bad = (f: string) => state.fields?.includes(f) ?? false;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("company")}
          required
          error={bad("company_name") ? t("checkField") : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="company_name"
              autoComplete="organization"
              required
              aria-invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          label={t("contact")}
          required
          error={bad("contact_name") ? t("checkField") : undefined}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              name="contact_name"
              autoComplete="name"
              required
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field label={t("phone")} required error={bad("phone") ? t("checkField") : undefined}>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field label={t("email")} required error={bad("email") ? t("checkField") : undefined}>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>
      <Choices
        legend={t("markets")}
        name="markets"
        options={markets}
        invalid={bad("market_slugs")}
      />
      <Choices
        legend={t("services")}
        name="services"
        options={services}
        invalid={bad("service_slugs")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("trucks")}
          required
          error={bad("truck_count") ? t("checkField") : undefined}
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              name="truck_count"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              required
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field
          label={t("insurance")}
          required
          error={bad("insurance_carrier") ? t("checkField") : undefined}
        >
          {({ id, invalid }) => (
            <Input id={id} name="insurance_carrier" required aria-invalid={invalid} />
          )}
        </Field>
        <Field label={t("license")}>{({ id }) => <Input id={id} name="license_number" />}</Field>
        <Field label={t("referral")}>{({ id }) => <Input id={id} name="referral_source" />}</Field>
      </div>
      <label className="flex min-h-touch cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="sms_consent"
          className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-sm">
          {t("smsConsent")}{" "}
          <Link className="underline underline-offset-4" href="/legal/sms-terms">
            {t("smsTerms")}
          </Link>
        </span>
      </label>
      {siteKey ? <Turnstile siteKey={siteKey} label={t("verify")} /> : null}
      <Button type="submit" loading={pending} className="self-start">
        {t("submit")}
      </Button>
    </form>
  );
}
