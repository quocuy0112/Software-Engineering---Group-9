import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterAnalyticsOverview } from "@/frontend/features/recruitment-analytics/recruiter-analytics-overview";

export const dynamic = "force-dynamic";

export default async function RecruiterJobAnalyticsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) {
    redirect("/login?returnTo=" + encodeURIComponent("/recruiter/analytics"));
  }

  const data = await readRecruiterJobManagementData(context.userId);
  if (!data.companyId) redirect("/recruiter/company-settings?required=profile");

  const { jobId } = await params;
  const job = data.jobs.find(
    (item) =>
      item.id === jobId &&
      (item.status === "active" || item.status === "closed"),
  );
  if (!job) notFound();

  return (
    <RecruiterAnalyticsOverview
      jobs={data.jobs}
      companies={data.companies}
      initialJobId={job.id}
    />
  );
}
