import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { resolveFlagAction } from "@/lib/flag-actions";
import type { RequestFlag } from "@/lib/flags";

/**
 * Flags (owner decision 3) on a request or a profile: who raised it, the reason and note, the
 * priority (safety is urgent) and, while open, a resolve form with a short note.
 */
export async function FlagList({
  flags,
  back,
  title,
  showCode = false,
  canResolve,
  hid = "flags-h",
}: {
  flags: RequestFlag[];
  /** The page to come back to after resolving. */
  back: string;
  title: string;
  showCode?: boolean;
  canResolve: boolean;
  /** The heading id (unique on the page). */
  hid?: string;
}) {
  const t = await getTranslations("admin.flags");
  const open = flags.filter((f) => f.status === "open").length;
  return (
    <section
      aria-labelledby={hid}
      data-testid="flag-list"
      className="rounded-2xl border bg-card p-4"
    >
      <h2 id={hid} className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
        {title}
        <Badge tone={open ? "warning" : "neutral"}>{t("openCount", { count: open })}</Badge>
      </h2>
      {flags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {flags.map((f) => (
            <li key={f.id} className="flex flex-col gap-1.5 py-2">
              <span className="flex flex-wrap items-center gap-2">
                {f.priority === "urgent" ? <Badge tone="critical">{t("urgent")}</Badge> : null}
                <Badge tone="outline">{t(`side.${f.side}`)}</Badge>
                <span className="font-medium">{t(`reasons.${f.side}.${f.reason}`)}</span>
                {showCode && f.code ? (
                  <Link
                    href={`/inbox?id=${f.requestId}`}
                    className="font-mono underline underline-offset-2"
                  >
                    {f.code}
                  </Link>
                ) : null}
                <Badge tone={f.status === "open" ? "warning" : "success"}>
                  {t(`status.${f.status}`)}
                </Badge>
              </span>
              {f.providerName ? (
                <span className="text-muted-foreground">
                  {t("provider", { name: f.providerName })}
                </span>
              ) : null}
              {f.note ? <q className="break-words">{f.note}</q> : null}
              {f.resolution ? (
                <span className="text-muted-foreground">
                  {t("resolution", { note: f.resolution })}
                </span>
              ) : null}
              {f.status === "open" && canResolve ? (
                <form action={resolveFlagAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="back" value={back} />
                  <label className="flex min-w-0 flex-1 flex-col gap-1 font-medium">
                    {t("resolutionLabel")}
                    <input name="resolution" maxLength={500} className={inputClass} />
                  </label>
                  <Button type="submit" variant="outline">
                    {t("resolve")}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
