"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import {
  inviteAction,
  setActiveAction,
  type TeamState,
  updateMemberAction,
} from "@/lib/team-actions";

type Option = { value: string; label: string };
const field = "flex flex-col gap-1 text-sm font-medium";

function Result({ state }: { state: TeamState }) {
  const t = useTranslations("admin.team");
  if (state.error) return <Alert tone="critical" title={t(`errors.${state.error}`)} />;
  if (state.ok)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t(`done.${state.ok}`)}
      </p>
    );
  return null;
}

/** Market limit: none checked means every market. */
function MarketChecks({ markets, chosen }: { markets: Option[]; chosen: string[] | null }) {
  const t = useTranslations("admin.team");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium">{t("markets")}</legend>
      <p className="text-xs text-muted-foreground">{t("marketsHint")}</p>
      <div className="flex flex-wrap gap-x-4">
        {markets.map((m) => (
          <label key={m.value} className="flex min-h-touch items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="markets"
              value={m.value}
              defaultChecked={chosen?.includes(m.value) ?? false}
              className="size-5 accent-[var(--primary)]"
            />
            {m.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function InviteForm({ roles, markets }: { roles: Option[]; markets: Option[] }) {
  const t = useTranslations("admin.team");
  const [state, action, pending] = useActionState<TeamState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={field}>
          {t("email")}
          <input name="email" type="email" required className={inputClass} />
        </label>
        <label className={field}>
          {t("name")}
          <input name="name" required minLength={2} className={inputClass} />
        </label>
        <label className={field}>
          {t("role")}
          <select name="role" required defaultValue="dispatcher" className={inputClass}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MarketChecks markets={markets} chosen={null} />
      <Button type="submit" loading={pending} className="self-start">
        {t("invite")}
      </Button>
      <Result state={state} />
      {state.inviteLink ? (
        <p className="rounded-lg border border-dashed p-3 text-sm break-all">
          {t("demoLink")} <a href={state.inviteLink}>{state.inviteLink}</a>
        </p>
      ) : null}
    </form>
  );
}

export function MemberForm({
  userId,
  role,
  chosen,
  active,
  roles,
  markets,
  canManage,
}: {
  userId: string;
  role: string;
  chosen: string[] | null;
  active: boolean;
  roles: Option[];
  markets: Option[];
  canManage: boolean;
}) {
  const t = useTranslations("admin.team");
  const [state, action, pending] = useActionState<TeamState, FormData>(updateMemberAction, {});
  const [toggle, setToggle] = useState<TeamState>({});
  const [toggling, start] = useTransition();
  if (!canManage) return null;
  return (
    <details className="w-full">
      <summary className="flex min-h-touch cursor-pointer items-center text-sm font-medium underline-offset-4 hover:underline">
        {t("edit")}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="userId" value={userId} />
        <label className={`${field} max-w-xs`}>
          {t("role")}
          <select name="role" defaultValue={role} className={inputClass}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <MarketChecks markets={markets} chosen={chosen} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={pending}>
            {t("save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={toggling}
            onClick={() => start(async () => setToggle(await setActiveAction(userId, !active)))}
          >
            {active ? t("deactivate") : t("reactivate")}
          </Button>
        </div>
        <Result state={toggle.ok || toggle.error ? toggle : state} />
      </form>
    </details>
  );
}
