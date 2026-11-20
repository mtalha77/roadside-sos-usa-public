import { timingSafeEqual } from "node:crypto";
import { createAdminSupabase } from "@rsos/db/admin";
import { chooseEmailSender, CreditExpiryEmail, creditExpirySubject } from "@rsos/emails";
import { formatCurrency } from "@rsos/i18n";
import type { NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const authorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(`Bearer ${secret}`);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

const Notice = z.object({
  id: z.uuid(),
  provider_id: z.uuid(),
  data: z.object({ cents: z.number(), expires_at: z.string(), days: z.string() }),
});

/**
 * Bonus credit expiry (RSOS-115), daily with CRON_SECRET: expires what is left on past grants
 * (ledger and audit rows), queues in-app reminders 7 days and 1 day before, and emails each
 * provider owner once per reminder (Resend, or the fake sender that records it).
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminSupabase();
  const rpc = admin.rpc.bind(admin) as unknown as (f: string) => PromiseLike<{ data: unknown }>;
  const expired = z
    .number()
    .catch(0)
    .parse((await rpc("expire_bonus_credits")).data);
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data } = await admin
    .from("provider_notices")
    .select("id, provider_id, data")
    .eq("kind", "bonus_expiring")
    .gte("created_at", since);
  const notices = z
    .array(Notice)
    .catch([])
    .parse(data ?? []);
  const sender = chooseEmailSender();
  let emailed = 0;
  for (const n of notices) {
    const [{ data: company }, { data: owners }] = await Promise.all([
      admin.from("providers").select("name").eq("id", n.provider_id).maybeSingle(),
      admin
        .from("provider_members")
        .select("user_id")
        .eq("provider_id", n.provider_id)
        .eq("role", "owner"),
    ]);
    for (const o of owners ?? []) {
      const { data: user } = await admin.auth.admin.getUserById(o.user_id);
      const to = user.user?.email;
      if (!to) continue;
      const days = Number(n.data.days);
      await sender
        .send({
          to,
          subject: creditExpirySubject(days),
          react: CreditExpiryEmail({
            company: company?.name ?? "",
            amount: formatCurrency(n.data.cents, "en"),
            date: new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
              new Date(n.data.expires_at),
            ),
            days,
          }),
          tags: { category: "credit_expiry" },
        })
        .then(() => (emailed += 1))
        .catch(() => null);
    }
  }
  return Response.json({ expired, reminders: notices.length, emailed });
}
