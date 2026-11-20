import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Cron routes (Vercel Cron and the scheduled GitHub workflows) send `Authorization: Bearer
 * <CRON_SECRET>`. Compared in constant time; without a secret configured nothing is authorized.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(`Bearer ${secret}`);
  const b = Buffer.from(request.headers.get("authorization") ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
