import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { sendDailyEmail } from "@/lib/ads-email";
import { importSpend, runAutoPause, uploadConversions } from "@/lib/ads-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(`Bearer ${secret}`);
  const b = Buffer.from(request.headers.get("authorization") ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
};

const Job = z.enum(["spend", "spend-full", "conversions", "autopause", "daily-email"]);

/**
 * Ad sync jobs (RSOS-107), called with CRON_SECRET by Vercel Cron (nightly) and by the scheduled
 * GitHub workflow `ads-sync.yml` (hourly and every 5 minutes):
 * spend (hourly: yesterday and today), spend-full (nightly: the last 7 days), conversions (hourly),
 * autopause (every 5 minutes), daily-email (hourly; sends once at the owner's hour).
 * Platforms without keys or switched off are skipped: nothing errors.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const job = Job.safeParse((await params).job);
  if (!job.success) return new Response("Not found", { status: 404 });
  switch (job.data) {
    case "spend":
      return Response.json(await importSpend({ days: 2 }));
    case "spend-full":
      return Response.json(await importSpend({ days: 7 }));
    case "conversions":
      return Response.json(await uploadConversions());
    case "autopause":
      return Response.json(await runAutoPause());
    case "daily-email":
      return Response.json(await sendDailyEmail());
  }
}
