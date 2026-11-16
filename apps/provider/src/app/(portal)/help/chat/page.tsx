import { getTranslations } from "next-intl/server";
import { DispatchChat } from "@/components/support/dispatch-chat";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const { data } = await getPortalData(ctx, Date.now());
  return [...data.activeJobs, ...data.history.slice(0, 10)].map((j) => ({
    id: j.id,
    code: j.code,
  }));
}

/** Chat with dispatch (RSOS-063), optionally linked to a job. Replies are simulated in demo mode. */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, jobs, sp] = await Promise.all([getTranslations("portal.help"), load(), searchParams]);
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("chatTitle")} subtitle={t("chatSubtitle")} />
      <DispatchChat
        jobs={jobs}
        initialJob={sp.job ?? ""}
        labels={{
          job: t("job"),
          noJob: t("noJob"),
          message: t("message"),
          send: t("send"),
          you: t("you"),
          dispatch: t("dispatch"),
          reply: t("reply"),
          empty: t("empty"),
        }}
      />
    </main>
  );
}
