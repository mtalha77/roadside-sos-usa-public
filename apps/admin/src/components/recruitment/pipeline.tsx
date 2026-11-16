"use client";

import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { useId, useState } from "react";

/** Cards shown per lane on the board; the table view lists every lead. */
const LANE_LIMIT = 25;

type Lead = {
  id: string;
  company: string;
  contact: string;
  phone: string;
  market: string;
  stage: string;
  trucks: number | null;
  source: string;
  demo: boolean;
  task: string | null;
};

/** Board or table of leads; stage changes, reminders and CSV imports stay on this page for now. */
export function Pipeline({
  leads: initial,
  stages,
  markets,
  labels: l,
}: {
  leads: Lead[];
  stages: { id: string; label: string }[];
  markets: Record<string, string>;
  labels: Record<string, string>;
}) {
  const id = useId();
  const [leads, setLeads] = useState(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [msg, setMsg] = useState<string | null>(null);
  const move = (lead: string, stage: string) =>
    setLeads((all) => all.map((x) => (x.id === lead ? { ...x, stage } : x)));
  const stageSelect = (x: Lead) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">
        {l.moveTo} {x.company}
      </span>
      <select
        className={`${inputClass} min-h-12`}
        value={x.stage}
        onChange={(e) => move(x.id, e.target.value)}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex gap-1">
          <legend className="sr-only">{l.view}</legend>
          {(["board", "table"] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? "secondary" : "ghost"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {l[v]}
            </Button>
          ))}
        </fieldset>
        <label htmlFor={`${id}-csv`} className="flex flex-col gap-1 text-sm font-medium">
          {l.import}
          <span className="font-normal text-muted-foreground">{l.importHint}</span>
          <input
            id={`${id}-csv`}
            type="file"
            accept=".csv,text/csv"
            className={inputClass}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const rows = (await file.text()).split(/\r?\n/).filter((r) => r.trim());
              const [head, ...body] = rows;
              const cols = (head ?? "")
                .toLowerCase()
                .split(",")
                .map((c) => c.trim());
              const ci = cols.indexOf("company");
              if (ci < 0) {
                setMsg(l.importError!);
                return;
              }
              const added: Lead[] = body.map((r, i) => {
                const v = r.split(",").map((c) => c.trim());
                return {
                  id: `import-${Date.now()}-${i}`,
                  company: v[ci] ?? "",
                  contact: v[cols.indexOf("contact")] ?? "",
                  phone: v[cols.indexOf("phone")] ?? "",
                  market: v[cols.indexOf("market")] ?? "",
                  stage: "lead",
                  trucks: Number(v[cols.indexOf("trucks")]) || null,
                  source: "import",
                  demo: true,
                  task: null,
                };
              });
              setLeads((all) => [...added, ...all]);
              setMsg(l.imported?.replace("{count}", String(added.length)) ?? "");
            }}
          />
        </label>
      </div>
      {msg ? (
        <p role="status" className="text-sm font-medium">
          {msg}
        </p>
      ) : null}
      {leads.length === 0 ? (
        <p className="text-muted-foreground">{l.empty}</p>
      ) : view === "board" ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stages.map((s) => {
            const list = leads.filter((x) => x.stage === s.id);
            return (
              <section
                key={s.id}
                aria-labelledby={`${id}-${s.id}`}
                className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/50 p-2"
              >
                <h2
                  id={`${id}-${s.id}`}
                  className="flex justify-between px-2 pt-1 text-sm font-semibold"
                >
                  {s.label}{" "}
                  <span className="tabular-nums text-muted-foreground">{list.length}</span>
                </h2>
                <ul
                  tabIndex={0}
                  aria-labelledby={`${id}-${s.id}`}
                  className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto"
                >
                  {list.slice(0, LANE_LIMIT).map((x) => (
                    <li key={x.id} className="rounded-xl border bg-card p-3 text-sm">
                      <p className="font-semibold">{x.company}</p>
                      <p className="text-muted-foreground">
                        {x.contact} · {markets[x.market] ?? x.market}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={x.demo ? "outline" : "info"}>{x.demo ? l.demo : l.real}</Badge>
                        {x.task ? <Badge tone="warning">{l.followUp}</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stageSelect(x)}
                        <Button
                          variant="ghost"
                          onClick={() => setMsg(`${l.reminded} ${x.company}`)}
                        >
                          {l.remind}
                        </Button>
                      </div>
                    </li>
                  ))}
                  {list.length > LANE_LIMIT ? (
                    <li className="px-2 py-1 text-sm text-muted-foreground">
                      {l.more?.replace("{count}", String(list.length - LANE_LIMIT))}
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label={l.table}
          className="overflow-x-auto rounded-2xl border bg-card"
        >
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                {["company", "contact", "market", "trucks", "source", "stage"].map((k) => (
                  <th key={k} scope="col" className="px-4 py-3 font-medium">
                    {l[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className="px-4 py-2 text-left font-semibold">
                    {x.company}
                  </th>
                  <td className="px-4 py-2">
                    {x.contact}
                    <span className="block text-muted-foreground">{x.phone}</span>
                  </td>
                  <td className="px-4 py-2">{markets[x.market] ?? x.market}</td>
                  <td className="px-4 py-2 tabular-nums">{x.trucks ?? "—"}</td>
                  <td className="px-4 py-2">{x.source}</td>
                  <td className="px-4 py-2">{stageSelect(x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
