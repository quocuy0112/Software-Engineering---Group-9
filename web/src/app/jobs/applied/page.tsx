import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateApplicationService } from "@/backend/services/jobs/candidate-application-service";
import { AppliedJobsPage } from "@/frontend/features/jobs/components/applied-jobs-page";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppliedJobsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fapplied");
  const result = await new CandidateApplicationService().list(
    { userId: context.userId, sessionId: context.sessionId },
    { limit: 24 },
  );
  return (
    <JobsWorkspace activeTab="applied">
      <AppliedJobsPage
        applications={result.applications}
        nextCursor={result.nextCursor}
      />
    </JobsWorkspace>
  );
}
