import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterCandidatesPage } from "@/frontend/features/recruiter-applications/recruiter-candidates-page";

export const dynamic = "force-dynamic";

export default async function RecruiterCandidateRankingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fcandidates");

  const data = await readRecruiterJobManagementData(context.userId);
  if (!data.companyId) redirect("/recruiter/company-settings?required=profile");

  const { jobId } = await params;
  if (!data.jobs.some((job) => job.id === jobId)) notFound();

  return <RecruiterCandidatesPage jobs={data.jobs} selectedJobId={jobId} />;
}
