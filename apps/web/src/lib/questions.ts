import "server-only";
import type { QuestionOverride } from "@rsos/core/service-questions";
import { createPublicSupabase } from "@rsos/db/public";
import { unstable_cache } from "next/cache";
import { z } from "zod";

const Row = z.object({
  service_slug: z.string(),
  question_id: z.string(),
  hidden: z.boolean(),
  required: z.boolean().nullable(),
  sort: z.number().nullable(),
  market_id: z.string().nullable(),
  markets: z.object({ slug: z.string() }).nullable(),
});

/**
 * Question overrides for a market (RSOS-116), set in Admin > Business > Services: market rows
 * win over the all-markets rows. Cached for a minute.
 */
export const getQuestionOverrides = unstable_cache(
  async (marketSlug: string | null): Promise<QuestionOverride[]> => {
    const supabase = createPublicSupabase();
    if (!supabase) return [];
    const { data } = await supabase
      .from("service_question_overrides")
      .select("service_slug, question_id, hidden, required, sort, market_id, markets(slug)");
    const rows = z
      .array(Row)
      .catch([])
      .parse(data ?? []);
    const pick = rows.filter((r) => r.market_id === null || r.markets?.slug === marketSlug);
    // Market-specific rows first, so they win in questionsFor().
    pick.sort((a, b) => Number(a.market_id === null) - Number(b.market_id === null));
    return pick.map((r) => ({
      service: r.service_slug,
      questionId: r.question_id,
      hidden: r.hidden,
      required: r.required,
      sort: r.sort,
    }));
  },
  ["question-overrides"],
  { revalidate: 60 },
);
