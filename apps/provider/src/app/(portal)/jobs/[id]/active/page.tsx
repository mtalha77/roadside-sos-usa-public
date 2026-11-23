import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FlagRequest } from "@/components/flags/flag-request";
import { JobFlow } from "@/components/jobs/job-flow";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  return (await getPortalData(ctx, Date.now())).data;
}

/** Active job (RSOS-055): the step-by-step flow for a job the company is working now. */
export default async function ActiveJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = decodeURIComponent(id);
  const [t, data] = await Promise.all([getTranslations("portal.active"), load()]);
  const job = data.activeJobs.find((j) => j.id === jobId);
  if (!job) notFound();
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title", { code: job.code })} />
      <JobFlow
        jobId={job.id}
        lat={job.lat}
        lng={job.lng}
        address={job.address}
        team={data.team.map((m) => m.name)}
      />
      <FlagRequest requestId={job.id} className="mt-4 self-start" />
    </main>
  );
}
