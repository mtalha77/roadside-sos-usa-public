"use client";

import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { useId, useRef, useState } from "react";

type Msg = { id: number; from: "you" | "dispatch"; text: string; job: string };

/** Chat with dispatch linked to a job; dispatch's reply is simulated in demo mode. */
export function DispatchChat({
  jobs,
  initialJob,
  labels,
}: {
  jobs: { id: string; code: string }[];
  initialJob: string;
  labels: Record<string, string>;
}) {
  const ids = { job: useId(), msg: useId() };
  const [job, setJob] = useState(jobs.some((j) => j.id === initialJob) ? initialJob : "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const n = useRef(0);
  const code = (id: string) => jobs.find((j) => j.id === id)?.code ?? "";
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={ids.job} className="flex flex-col gap-2 text-sm font-medium">
        {labels.job}
        <select
          id={ids.job}
          className={inputClass}
          value={job}
          onChange={(e) => setJob(e.target.value)}
        >
          <option value="">{labels.noJob}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.code}
            </option>
          ))}
        </select>
      </label>
      <ol
        aria-live="polite"
        className="flex min-h-48 flex-col gap-2 rounded-2xl border bg-card p-4"
      >
        {messages.length === 0 ? <li className="text-muted-foreground">{labels.empty}</li> : null}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 ${m.from === "you" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"}`}
          >
            <span className="block text-xs font-semibold">
              {m.from === "you" ? labels.you : labels.dispatch}
              {m.job ? ` · ${code(m.job)}` : ""}
            </span>
            {m.text}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const text = String(new FormData(f).get("message") ?? "").trim();
          if (!text) return;
          n.current += 2;
          const id = n.current;
          setMessages((m) => [...m, { id, from: "you", text, job }]);
          f.reset();
          setTimeout(
            () =>
              setMessages((m) => [
                ...m,
                { id: id + 1, from: "dispatch", text: labels.reply!, job },
              ]),
            1200,
          );
        }}
      >
        <label htmlFor={ids.msg} className="sr-only">
          {labels.message}
        </label>
        <input
          id={ids.msg}
          name="message"
          className={inputClass}
          placeholder={labels.message}
          autoComplete="off"
        />
        <Button type="submit">{labels.send}</Button>
      </form>
    </div>
  );
}
