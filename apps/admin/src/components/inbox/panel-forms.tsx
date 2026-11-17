"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import {
  type InboxActionState,
  assignAction,
  attemptAction,
  claimAction,
  intakeAction,
  locationLinkAction,
  noteAction,
  stepAction,
  textAction,
} from "@/lib/inbox-actions";

const field = "flex flex-col gap-1 text-sm font-medium";

function Result({ state }: { state: InboxActionState }) {
  const t = useTranslations("admin.inbox.result");
  if (state.error) return <Alert tone="critical" title={t(`errors.${state.error}`)} />;
  if (state.ok)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("ok")}
      </p>
    );
  return null;
}

export function ClaimButton({
  id,
  mine,
  owner,
}: {
  id: string;
  mine: boolean;
  owner: string | null;
}) {
  const t = useTranslations("admin.inbox");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (mine) return <p className="text-sm font-medium">{t("yours")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        loading={pending}
        onClick={() => start(async () => setFailed(!(await claimAction(id, false))))}
      >
        {owner ? t("takeOver") : t("claim")}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-critical-strong">
          {t("claimTaken")}
        </p>
      ) : null}
    </div>
  );
}

export function StepButtons({
  id,
  next,
  inputClass,
}: {
  id: string;
  next: string[];
  inputClass: string;
}) {
  const t = useTranslations("admin.inbox");
  const [state, action, pending] = useActionState<InboxActionState, FormData>(stepAction, {});
  const [ending, setEnding] = useState<"cancelled" | "no_provider" | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={id} />
        {next.map((s) => (
          <Button
            key={s}
            type="submit"
            name="status"
            value={s}
            size="sm"
            variant="outline"
            loading={pending}
          >
            {t(`stepTo.${s}`)}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => setEnding("no_provider")}>
          {t("stepTo.no_provider")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEnding("cancelled")}>
          {t("stepTo.cancelled")}
        </Button>
      </form>
      {ending ? (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={ending} />
          <label className={`${field} flex-1`}>
            {t("reason")}
            <input name="reason" required minLength={3} maxLength={500} className={inputClass} />
          </label>
          <Button type="submit" size="sm" variant="destructive" loading={pending}>
            {t(`stepTo.${ending}`)}
          </Button>
        </form>
      ) : null}
      <Result state={state} />
    </div>
  );
}

export function IntakeForm({
  id,
  name,
  address,
  serviceId,
  services,
  notes,
  vehicle,
  inputClass,
}: {
  id: string;
  name: string;
  address: string;
  serviceId: string | null;
  services: { id: string; name: string }[];
  notes: string;
  vehicle: string;
  inputClass: string;
}) {
  const t = useTranslations("admin.inbox.intake");
  const [state, action, pending] = useActionState<InboxActionState, FormData>(intakeAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <label className={field}>
        {t("name")}
        <input name="name" required defaultValue={name} className={inputClass} />
      </label>
      <label className={field}>
        {t("service")}
        <select name="service" required defaultValue={serviceId ?? ""} className={inputClass}>
          <option value="" disabled>
            {t("choose")}
          </option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${field} sm:col-span-2`}>
        {t("address")}
        <input
          name="address"
          required
          minLength={3}
          defaultValue={address}
          className={inputClass}
        />
      </label>
      <label className={field}>
        {t("vehicle")}
        <input name="vehicle" defaultValue={vehicle} className={inputClass} />
      </label>
      <label className={field}>
        {t("notes")}
        <input name="notes" defaultValue={notes} className={inputClass} />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="self-start" loading={pending}>
          {t("save")}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function AttemptForm({
  id,
  provider,
  inputClass,
}: {
  id: string;
  provider: string;
  inputClass: string;
}) {
  const t = useTranslations("admin.inbox.dispatch");
  const [state, action, pending] = useActionState<InboxActionState, FormData>(attemptAction, {});
  const [assignState, assign, assigning] = useActionState<InboxActionState, FormData>(
    assignAction,
    {},
  );
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="provider" value={provider} />
        <label className={field}>
          {t("price")}
          <input name="price" inputMode="decimal" className={`${inputClass} w-24`} />
        </label>
        <label className={field}>
          {t("eta")}
          <input name="eta" inputMode="numeric" className={`${inputClass} w-20`} />
        </label>
        <Button
          type="submit"
          name="outcome"
          value="quoted"
          size="sm"
          variant="outline"
          loading={pending}
        >
          {t("quoted")}
        </Button>
        <Button type="submit" name="outcome" value="no_answer" size="sm" variant="ghost">
          {t("noAnswer")}
        </Button>
        <Button type="submit" name="outcome" value="declined" size="sm" variant="ghost">
          {t("declined")}
        </Button>
        <Button type="submit" size="sm" formAction={assign} loading={assigning}>
          {t("assign")}
        </Button>
      </form>
      <Result state={assignState.ok || assignState.error ? assignState : state} />
    </div>
  );
}

export function TextComposer({
  id,
  replies,
  fill,
  inputClass,
}: {
  id: string;
  replies: { id: string; title: string; body: string }[];
  fill: Record<string, string>;
  inputClass: string;
}) {
  const t = useTranslations("admin.inbox.texts");
  const [state, action, pending] = useActionState<InboxActionState, FormData>(textAction, {});
  const [body, setBody] = useState("");
  const [linkPending, startLink] = useTransition();
  const [linkState, setLinkState] = useState<InboxActionState>({});
  const apply = (template: string) =>
    setBody(template.replace(/\{(\w+)\}/g, (m, k: string) => fill[k] ?? m));
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className={field}>
        {t("savedReplies")}
        <select
          className={inputClass}
          defaultValue=""
          onChange={(e) => {
            const r = replies.find((x) => x.id === e.target.value);
            if (r) apply(r.body);
          }}
        >
          <option value="">{t("chooseReply")}</option>
          {replies.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t("message")}
        <textarea
          name="body"
          required
          maxLength={640}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${inputClass} min-h-24 py-2`}
        />
      </label>
      <p className="text-xs text-muted-foreground">{t("length", { count: body.length })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={pending}>
          {t("send")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={linkPending}
          onClick={() => startLink(async () => setLinkState(await locationLinkAction(id)))}
        >
          {t("sendLink")}
        </Button>
      </div>
      <Result state={linkState.ok || linkState.error ? linkState : state} />
    </form>
  );
}

export function NoteForm({ id, inputClass }: { id: string; inputClass: string }) {
  const t = useTranslations("admin.inbox");
  const [state, action, pending] = useActionState<InboxActionState, FormData>(noteAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className={`${field} flex-1`}>
        {t("note")}
        <input name="note" required maxLength={1000} className={inputClass} />
      </label>
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        {t("addNote")}
      </Button>
      <Result state={state} />
    </form>
  );
}
