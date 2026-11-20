import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { InboxLive } from "@/components/inbox/inbox-live";
import { PageTourButton } from "@/components/tours/admin-tours";
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
  const [ctx, t, tt, sp] = await Promise.all([
    getAdminContext(),
    getTranslations("admin.inbox"),
    getTranslations("tours.labels"),
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
      <div className="flex min-w-0 flex-col gap-3">
        {/* Phone intake now opens from here and from Calls (RSOS-103). */}
        <div className="flex items-center gap-2">
          <Link
            href="/intake"
            data-tour="inbox-log-call"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
          >
            {t("logCall")}
          </Link>
          <PageTourButton tour="admin.page.inbox" label={tt("page")} />
        </div>
        <div data-tour="inbox-list" className="min-w-0">
          <InboxLive
            initial={inbox}
            markets={markets.map((m) => ({ id: m.id, name: m.name }))}
            selectedId={id.success ? id.data : null}
          />
        </div>
      </div>
      {selected ? (
        <RequestPanel data={selected} userId={ctx.userId} role={ctx.role} />
      ) : (
        <p className="hidden rounded-2xl border border-dashed p-6 text-muted-foreground lg:block">
          {t("pick")}
        </p>
      )}
    </main>
  );
}
