import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterPipelinePage } from "@/frontend/features/recruiter-applications/recruiter-pipeline-page";

export const dynamic = "force-dynamic";

export default async function RecruiterPipelineRoute({
  searchParams,
}: {
  searchParams?: Promise<{ jobId?: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fpipeline");

  const data = await readRecruiterJobManagementData(context.userId);
  if (!data.companyId) redirect("/recruiter/company-settings?required=profile");

  const query = searchParams ? await searchParams : {};
  return (
    <RecruiterPipelinePage
      jobs={data.jobs}
      companies={data.companies}
      initialJobId={query.jobId}
    />
  );
}
