"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { LiveDot } from "@rsos/ui/live-dot";
import { useId, useState } from "react";

type Member = {
  id: string;
  name: string;
  truck: string;
  online: boolean;
  role: string;
  roleLabel: string;
};
type Job = { id: string; code: string; area: string; operator: string };
const card = "rounded-2xl border bg-card p-4 sm:p-5";

/** Members, text invites and job assignment (kept on this device in demo mode). */
export function TeamPanel({
  canManage,
  members,
  jobs,
  labels,
}: {
  canManage: boolean;
  members: Member[];
  jobs: Job[];
  labels: Record<string, string>;
}) {
  const ids = { phone: useId(), name: useId(), role: useId() };
  const [sent, setSent] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    Object.fromEntries(jobs.map((j) => [j.id, j.operator])),
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card} aria-labelledby="mem-h">
        <h2 id="mem-h" className="mb-2 font-semibold">
          {labels.members}
        </h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.roleLabel} · {m.truck}
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm">
                {m.online ? <LiveDot /> : null}
                {m.online ? labels.online : labels.offline}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {canManage ? (
        <form
          className={card}
          aria-labelledby="inv-h"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setSent(String(f.get("name") ?? ""));
            e.currentTarget.reset();
          }}
        >
          <h2 id="inv-h" className="mb-3 font-semibold">
            {labels.invite}
          </h2>
          <div className="flex flex-col gap-3">
            <label htmlFor={ids.name} className="text-sm font-medium">
              {labels.name}
            </label>
            <input id={ids.name} name="name" required className={inputClass} autoComplete="off" />
            <label htmlFor={ids.phone} className="text-sm font-medium">
              {labels.phone}
            </label>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              required
              className={inputClass}
              autoComplete="off"
            />
            <label htmlFor={ids.role} className="text-sm font-medium">
              {labels.role}
            </label>
            <select id={ids.role} name="role" className={inputClass}>
              <option value="operator">{labels.roles}</option>
              <option value="manager">{labels.rolesManager}</option>
            </select>
            <Button type="submit">{labels.send}</Button>
            {sent ? <Alert tone="success" title={`${labels.sent} ${sent}`} /> : null}
          </div>
        </form>
      ) : null}
      <section className={`${card} md:col-span-2`} aria-labelledby="jobs-h">
        <h2 id="jobs-h" className="mb-2 font-semibold">
          {labels.jobs}
        </h2>
        {!canManage ? (
          <p className="mb-2 text-sm text-muted-foreground">{labels.onlyMine}</p>
        ) : null}
        {jobs.length === 0 ? (
          <p className="text-muted-foreground">{labels.noJobs}</p>
        ) : (
          <ul className="divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="font-medium">
                  {j.code} · {j.area}
                </p>
                {canManage ? (
                  <label className="flex items-center gap-2 text-sm">
                    {labels.assign}
                    <select
                      className={inputClass}
                      value={assigned[j.id]}
                      onChange={(e) => setAssigned((a) => ({ ...a, [j.id]: e.target.value }))}
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {labels.assigned} {assigned[j.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
