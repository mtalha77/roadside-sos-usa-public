import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { InboxLive } from "@/components/inbox/inbox-live";
import { RequestPanel } from "@/components/inbox/request-panel";
import { getAdminContext } from "@/lib/admin";
import { getInbox, getInboxRequest } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/**
 * Inbox (RSOS-034b): every new web request, call, voicemail and text in one live list, and the
 * selected request's panel for manual dispatch during the test campaign.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [ctx, t, sp] = await Promise.all([
    getAdminContext(),
    getTranslations("admin.inbox"),
    searchParams,
  ]);
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const id = z.uuid().safeParse(sp.id);
  const [inbox, selected] = await Promise.all([
    getInbox(markets.map((m) => m.id)),
    id.success ? getInboxRequest(id.data) : Promise.resolve(null),
  ]);
  return (
    <main
      id="main"
      className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
    >
      <InboxLive
        initial={inbox}
        markets={markets.map((m) => ({ id: m.id, name: m.name }))}
        selectedId={id.success ? id.data : null}
      />
      {selected ? (
        <RequestPanel data={selected} userId={ctx.userId} />
      ) : (
        <p className="hidden rounded-2xl border border-dashed p-6 text-muted-foreground lg:block">
          {t("pick")}
        </p>
      )}
    </main>
  );
}
