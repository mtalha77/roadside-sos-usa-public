import { questionsFor, tagsOf } from "@rsos/core/service-questions";
import { Badge } from "@rsos/ui/badge";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const Answers = z.record(z.string(), z.string());

/**
 * A request's Get Help answers (RSOS-116): short tags first ("Flatbed needed", "Child inside:
 * urgent"), then every answer, the scheduled time and the private photos (signed for 10 minutes;
 * staff of the request's market only, by storage policy).
 */
export async function RequestAnswers({
  service,
  stored,
  photos,
  scheduledFor,
  timeZone,
}: {
  service: string;
  stored: unknown;
  photos: string[];
  scheduledFor: string | null;
  timeZone?: string;
}) {
  const [t, tq, tags] = await Promise.all([
    getTranslations("admin.answers"),
    getTranslations("getHelp.q"),
    getTranslations("serviceTags"),
  ]);
  const parsed = Answers.safeParse(stored);
  if (!parsed.success) return <span>{t("none")}</span>;
  const a = parsed.data;
  const list = questionsFor(service).filter((q) => a[q.id] !== undefined);
  const value = (id: string, v: string) =>
    tq.has(`${id}.options.${v}` as never) ? tq(`${id}.options.${v}` as never) : v;
  let urls: string[] = [];
  if (photos.length) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.storage.from("job-photos").createSignedUrls(photos, 600);
    urls = (data ?? []).flatMap((d) => (d.signedUrl ? [d.signedUrl] : []));
  }
  const tagList = tagsOf(service, a);
  return (
    <div className="flex flex-col gap-2">
      {tagList.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("tags")}>
          {tagList.map((g) => (
            <li key={g}>
              <Badge tone={g === "childInside" || g === "inLane" ? "critical" : "warning"}>
                {tags(g as never)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-sm">
        {list.map((q) => (
          <div key={q.id} className="contents">
            <dt className="text-muted-foreground">{tq(`${q.id}.label` as never)}</dt>
            <dd className="text-right font-medium">{value(q.id, a[q.id]!)}</dd>
          </div>
        ))}
      </dl>
      {scheduledFor ? (
        <p className="text-sm font-medium">
          {t("scheduled", {
            at: new Date(scheduledFor).toLocaleString("en-US", {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      ) : null}
      {urls.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("photos")}>
          {urls.map((u, i) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={t("photo", { n: i + 1 })}
                  className="size-20 rounded-lg border object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
