"use client";

import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@rsos/ui/card";
import { Field } from "@rsos/ui/field";
import { Input, Textarea } from "@rsos/ui/input";
import { RadioCards } from "@rsos/ui/radio-cards";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useActionState, useState, useTransition } from "react";
import type { AccountData } from "../server/queries";
import {
  type ActionState,
  changeEmailAction,
  changePasswordAction,
  confirmTotpEnrollAction,
  forgetDeviceAction,
  generateRecoveryCodesAction,
  requestClosureAction,
  revokeSessionAction,
  setSecondStepMethodAction,
  startTotpEnrollAction,
  updateNameAction,
} from "../server/actions";
import { deviceLabel, when } from "./when";

type Props = {
  data: AccountData;
  /** Providers choose their second step; admins always use the authenticator. */
  audience: "provider" | "admin";
  /** SMS codes need Twilio (owner blocker); the option shows as unavailable until then. */
  smsAvailable?: boolean;
  /** Link to change the phone number (provider phone verification screen). */
  phoneHref?: string;
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function Feedback({ state, ok }: { state: ActionState; ok: string }) {
  const t = useTranslations("account");
  if (state.ok) return <Alert tone="success" title={ok} />;
  if (state.error)
    return (
      <Alert
        tone="critical"
        title={
          state.error === "invalid"
            ? t("currentWrong")
            : state.error === "required"
              ? t("checkFields")
              : t("genericError")
        }
      />
    );
  return null;
}

export function AccountSecurity({ data, audience, smsAvailable = false, phoneHref }: Props) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [name, nameAction, namePending] = useActionState<ActionState, FormData>(
    updateNameAction,
    {},
  );
  const [email, emailAction, emailPending] = useActionState<ActionState, FormData>(
    changeEmailAction,
    {},
  );
  const [pw, pwAction, pwPending] = useActionState<ActionState, FormData>(changePasswordAction, {});
  const [method, methodAction, methodPending] = useActionState<ActionState, FormData>(
    setSecondStepMethodAction,
    {},
  );
  const [closure, closureAction, closurePending] = useActionState<ActionState, FormData>(
    requestClosureAction,
    {},
  );
  const [totp, totpAction, totpPending] = useActionState<ActionState, FormData>(
    confirmTotpEnrollAction,
    {},
  );
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(
    null,
  );
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, startTransition] = useTransition();
  const [choice, setChoice] = useState<string>(data.method);

  return (
    <div className="flex flex-col gap-6">
      <Section title={t("profile")}>
        <form action={nameAction} className="flex flex-col gap-4" noValidate>
          <Feedback state={name} ok={t("saved")} />
          <Field label={t("name")}>
            {({ id }) => (
              <Input
                id={id}
                name="name"
                defaultValue={data.user.name}
                autoComplete="name"
                required
              />
            )}
          </Field>
          <Button type="submit" variant="outline" loading={namePending} className="self-start">
            {t("save")}
          </Button>
        </form>
        <form action={emailAction} className="flex flex-col gap-4" noValidate>
          <Feedback state={email} ok={t("emailChangeSent")} />
          {data.user.newEmail ? (
            <Alert tone="info" title={t("emailPending", { email: data.user.newEmail })} />
          ) : null}
          <Field label={t("email")} description={t("emailChangeNote")}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                name="email"
                type="email"
                defaultValue={data.user.email}
                autoComplete="email"
                aria-describedby={describedBy}
                required
              />
            )}
          </Field>
          <Button type="submit" variant="outline" loading={emailPending} className="self-start">
            {t("emailChange")}
          </Button>
        </form>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t("phone")}</h3>
          <p className="text-muted-foreground">
            {data.user.phone && data.user.phoneConfirmed
              ? t("phoneVerified", { phone: data.user.phone })
              : t("phoneMissing")}
          </p>
          {phoneHref ? (
            <Button asChild variant="outline" className="self-start">
              <a href={phoneHref}>{t("changePhone")}</a>
            </Button>
          ) : null}
        </div>
      </Section>

      <Section title={t("password")}>
        <form action={pwAction} className="flex flex-col gap-4" noValidate>
          <Feedback state={pw} ok={t("passwordChanged")} />
          <Field label={t("currentPassword")}>
            {({ id }) => (
              <Input
                id={id}
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>
          <Field label={t("newPassword")}>
            {({ id }) => (
              <Input
                id={id}
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            )}
          </Field>
          <Button type="submit" variant="outline" loading={pwPending} className="self-start">
            {t("changePassword")}
          </Button>
        </form>
      </Section>

      <Section
        title={t("secondStep")}
        description={audience === "admin" ? t("secondStepRequired") : undefined}
      >
        {audience === "provider" ? (
          <form action={methodAction} className="flex flex-col gap-4">
            <Feedback state={method} ok={t("saved")} />
            <RadioCards
              name="method"
              value={choice}
              onValueChange={setChoice}
              aria-label={t("secondStep")}
              options={[
                {
                  value: "email",
                  title: t("secondStepEmail"),
                  description: t("secondStepEmailHint"),
                },
                {
                  value: "sms",
                  title: t("secondStepSms"),
                  description: t("secondStepSmsHint"),
                  disabled: !smsAvailable,
                },
                {
                  value: "totp",
                  title: t("secondStepTotp"),
                  description: t("secondStepTotpHint"),
                  disabled: !data.hasTotp,
                },
              ]}
            />
            <Button type="submit" variant="outline" loading={methodPending} className="self-start">
              {t("save")}
            </Button>
          </form>
        ) : null}
        {!data.hasTotp || audience === "provider" ? (
          enroll ? (
            <form action={totpAction} className="flex flex-col gap-4" noValidate>
              <Feedback state={totp} ok={t("totpReady")} />
              {/* The QR code is an SVG data URL generated by Supabase Auth. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enroll.qr}
                alt={t("totpQr")}
                width={180}
                height={180}
                className="rounded-lg bg-white p-2"
              />
              <p className="text-sm break-all text-muted-foreground">
                {t("totpKey", { key: enroll.secret })}
              </p>
              <input type="hidden" name="factorId" value={enroll.factorId} />
              <Field label={t("code")}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                )}
              </Field>
              <Button type="submit" variant="outline" loading={totpPending} className="self-start">
                {t("verify")}
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              loading={busy}
              className="self-start"
              onClick={() =>
                startTransition(async () => {
                  const r = await startTotpEnrollAction();
                  if ("factorId" in r) setEnroll(r);
                })
              }
            >
              {data.hasTotp ? t("totpReplace") : t("totpSetUp")}
            </Button>
          )
        ) : null}
      </Section>

      <Section title={t("recovery")} description={t("recoveryHint")}>
        {codes ? (
          <>
            <Alert tone="warning" title={t("recoveryShown")} />
            <ul
              className="grid grid-cols-2 gap-2 font-mono tabular-nums"
              aria-label={t("recovery")}
            >
              {codes.map((c) => (
                <li key={c} className="rounded-md bg-muted px-3 py-2">
                  {c}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <Button
          type="button"
          variant="outline"
          loading={busy}
          className="self-start"
          onClick={() =>
            startTransition(async () => {
              const r = await generateRecoveryCodesAction();
              if (r.codes) setCodes(r.codes);
            })
          }
        >
          {t("recoveryGenerate")}
        </Button>
      </Section>

      <Section title={t("devices")}>
        <ul className="flex flex-col divide-y">
          {data.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {deviceLabel(s.user_agent) ?? t("unknownDevice")}{" "}
                  {s.is_current ? <Badge>{t("thisDevice")}</Badge> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("lastActive", { time: when(s.refreshed_at ?? s.created_at, locale) })}
                </p>
              </div>
              {s.is_current ? null : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="session" value={s.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t("signOutDevice")}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {audience === "provider" ? (
          <>
            <h3 className="font-semibold">{t("trusted")}</h3>
            <p className="text-sm text-muted-foreground">{t("trustedHint")}</p>
            {data.devices.length === 0 ? (
              <p>{t("noTrusted")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.devices.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {deviceLabel(d.user_agent) ?? t("unknownDevice")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("trustedUntil", { time: when(d.expires_at, locale) })}
                      </p>
                    </div>
                    <form action={forgetDeviceAction}>
                      <input type="hidden" name="device" value={d.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {t("forget")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </Section>

      <Section title={t("history")}>
        {data.events.length === 0 ? (
          <p>{t("noHistory")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.events.map((e, i) => (
              <li
                key={`${e.created_at}-${i}`}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>{t.has(`events.${e.action}`) ? t(`events.${e.action}`) : e.action}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {when(e.created_at, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {audience === "provider" ? (
        <Section title={t("closure")} description={t("closureHint")}>
          {closure.ok ? (
            <Alert tone="success" title={t("closureRequested")} />
          ) : (
            <form action={closureAction} className="flex flex-col gap-4">
              <Field label={t("closureReason")}>
                {({ id }) => <Textarea id={id} name="reason" maxLength={2000} />}
              </Field>
              <Button
                type="submit"
                variant="destructive"
                loading={closurePending}
                className="self-start"
              >
                {t("closureRequest")}
              </Button>
            </form>
          )}
        </Section>
      ) : null}
    </div>
  );
}
