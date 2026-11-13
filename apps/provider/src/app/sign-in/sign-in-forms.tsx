"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Field } from "@rsos/ui/field";
import { Input } from "@rsos/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rsos/ui/tabs";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type AuthFormState, magicLinkAction, passwordSignInAction } from "@/lib/auth-actions";

export function ProviderSignIn({ expired }: { expired: boolean }) {
  const t = useTranslations("auth");
  const [pw, pwAction, pwPending] = useActionState<AuthFormState, FormData>(
    passwordSignInAction,
    {},
  );
  const [link, linkAction, linkPending] = useActionState<AuthFormState, FormData>(
    magicLinkAction,
    {},
  );
  return (
    <Tabs defaultValue="password">
      <TabsList aria-label={t("provider.title")} className="w-full">
        <TabsTrigger value="password">{t("provider.passwordTab")}</TabsTrigger>
        <TabsTrigger value="link">{t("provider.linkTab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="password">
        <form action={pwAction} className="flex flex-col gap-4" noValidate>
          {expired && !pw.error ? <Alert tone="info" title={t("errors.expired")} /> : null}
          {pw.error ? <Alert tone="critical" title={t(`errors.${pw.error}`)} /> : null}
          <Field label={t("email")}>
            {({ id }) => (
              <Input id={id} name="email" type="email" autoComplete="username" required />
            )}
          </Field>
          <Field label={t("password")}>
            {({ id }) => (
              <Input
                id={id}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>
          <Button type="submit" loading={pwPending} className="w-full">
            {t("signIn")}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="link">
        {link.linkSent ? (
          <Alert tone="success" title={t("provider.linkSent")} />
        ) : (
          <form action={linkAction} className="flex flex-col gap-4" noValidate>
            {link.error ? <Alert tone="critical" title={t(`errors.${link.error}`)} /> : null}
            <Field label={t("email")}>
              {({ id }) => (
                <Input id={id} name="email" type="email" autoComplete="email" required />
              )}
            </Field>
            <Button type="submit" loading={linkPending} className="w-full">
              {t("provider.sendLink")}
            </Button>
          </form>
        )}
      </TabsContent>
    </Tabs>
  );
}
