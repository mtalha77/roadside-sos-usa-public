import { serviceIcons, type ServiceIconKey } from "@rsos/ui/icons";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { serviceName } from "./service-label";

type Item = { slug: string; name: string; icon_key: string; hint?: string | null };

/** Big service tiles; each opens the request flow with that service (and market) selected. */
export async function ServiceLinks({
  services,
  marketSlug,
  hrefFor,
  headingLevel = 3,
}: {
  services: Item[];
  marketSlug?: string | null;
  hrefFor?: (slug: string) => string;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations("site");
  const H = headingLevel === 2 ? "h2" : "h3";
  const href = (slug: string) =>
    hrefFor?.(slug) ?? `/get-help?service=${slug}${marketSlug ? `&market=${marketSlug}` : ""}`;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {services.map((s) => {
        const Glyph = serviceIcons[s.icon_key as ServiceIconKey];
        return (
          <li key={s.slug}>
            <Link
              href={href(s.slug)}
              className="group flex h-full min-h-28 flex-col items-start gap-3 rounded-2xl border-2 border-border bg-surface p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-input hover:shadow-md active:scale-[0.98] sm:p-5"
            >
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-xl bg-muted [&_svg]:size-7"
              >
                {Glyph ? <Glyph /> : null}
              </span>
              <span className="flex flex-col gap-0.5">
                <H className="text-lg leading-tight font-semibold">{serviceName(t, s)}</H>
                <span className="text-sm text-muted-foreground">
                  {s.hint ?? serviceName(t, s, "short")}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
