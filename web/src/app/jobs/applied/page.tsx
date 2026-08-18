import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateApplicationTrackingService } from "@/backend/candidate-applications/candidate-application-tracking-service";
import { CandidateApplicationsListPage } from "@/frontend/features/candidate-applications/components/candidate-applications-list-page";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppliedJobsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fapplied");
  const result = await new CandidateApplicationTrackingService().list(
    { userId: context.userId, sessionId: context.sessionId },
    { limit: 24 },
  );
  return <JobsWorkspace><CandidateApplicationsListPage initialApplications={result.applications} initialNextCursor={result.nextCursor} /></JobsWorkspace>;
}
