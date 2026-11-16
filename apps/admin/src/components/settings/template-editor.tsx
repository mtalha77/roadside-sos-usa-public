"use client";

import { demoMarkets } from "@rsos/config/demo-fixtures";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass, Textarea } from "@rsos/ui/input";
import { useId, useState } from "react";

type Template = { id: string; name: string; en: string; es: string };
const SAMPLE: Record<string, string> = {
  "{code}": "D-WLOK",
  "{provider}": Object.values(demoMarkets)[0]?.providers[0]?.name ?? "",
  "{eta}": "18 min",
  "{price}": "$95.00",
};

/** Message templates in English and Spanish with a filled-in preview (kept on this page for now). */
export function TemplateEditor({
  templates,
  channels,
  labels: l,
}: {
  templates: Template[];
  channels: { id: string; label: string }[];
  labels: Record<string, string>;
}) {
  const id = useId();
  const [current, setCurrent] = useState(templates[0]?.id ?? "");
  const [channel, setChannel] = useState(channels[0]?.id ?? "");
  const [texts, setTexts] = useState(() =>
    Object.fromEntries(templates.map((t) => [t.id, { en: t.en, es: t.es }])),
  );
  const [saved, setSaved] = useState(false);
  const tpl = texts[current] ?? { en: "", es: "" };
  const fill = (s: string) => Object.entries(SAMPLE).reduce((a, [k, v]) => a.replaceAll(k, v), s);
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.template}
          <select
            className={inputClass}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.channel}
          <select
            className={inputClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{l.variables}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["en", "es"] as const).map((lang) => (
          <div key={lang} className="flex flex-col gap-2">
            <label htmlFor={`${id}-${lang}`} className="text-sm font-medium">
              {lang === "en" ? l.english : l.spanish}
            </label>
            <Textarea
              id={`${id}-${lang}`}
              rows={4}
              value={tpl[lang]}
              onChange={(e) =>
                setTexts((all) => ({ ...all, [current]: { ...tpl, [lang]: e.target.value } }))
              }
            />
            <p className="rounded-xl bg-muted p-3 text-sm">
              <span className="block text-xs font-medium text-muted-foreground">{l.preview}</span>
              {fill(tpl[lang])}
            </p>
          </div>
        ))}
      </div>
      {saved ? <Alert tone="success" title={l.saved} /> : null}
      <Button type="submit" className="self-start">
        {l.save}
      </Button>
    </form>
  );
}
