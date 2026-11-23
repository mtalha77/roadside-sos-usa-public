"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Textarea } from "@rsos/ui/input";
import { useActionState, useId, useState } from "react";
import { saveMarketIntro, type SaveIntroState } from "@/lib/content-actions";

/** Edit a market's city page intro with a live preview; saving is real (and audited). */
export function IntroEditor({
  slug,
  name,
  initial,
  canEdit,
  labels: l,
}: {
  slug: string;
  name: string;
  initial: string;
  canEdit: boolean;
  labels: Record<string, string>;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [state, action, pending] = useActionState<SaveIntroState, FormData>(saveMarketIntro, {
    status: "idle",
  });
  return (
    <form
      action={action}
      className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5 lg:grid-cols-2"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="font-semibold">
          {l.intro?.replace("{name}", name)}
        </label>
        <Textarea
          id={id}
          name="intro"
          rows={7}
          minLength={40}
          maxLength={1200}
          readOnly={!canEdit}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          {l.count?.replace("{n}", String(text.length))}
        </p>
        {canEdit ? (
          <Button type="submit" disabled={pending} className="self-start">
            {l.publish}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{l.readOnly}</p>
        )}
        {state.status === "saved" ? <Alert tone="success" title={l.saved} /> : null}
        {state.status === "invalid" ? <Alert tone="critical" title={l.invalid} /> : null}
        {state.status === "forbidden" ? <Alert tone="critical" title={l.forbidden} /> : null}
        {state.status === "error" ? <Alert tone="critical" title={l.error} /> : null}
      </div>
      <section aria-label={l.preview} className="rounded-xl border bg-background p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {l.preview}
        </p>
        <h3 className="text-xl font-semibold">{l.previewTitle?.replace("{name}", name)}</h3>
        <p className="mt-2 text-muted-foreground">{text}</p>
      </section>
    </form>
  );
}
