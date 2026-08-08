import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readJobWorkspaceSnapshot } from "@/backend/services/jobs/job-workspace-data";
import { AppliedJobsPage } from "@/frontend/features/jobs/components/applied-jobs-page";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppliedJobsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fapplied");
  const snapshot = await readJobWorkspaceSnapshot(context.userId);
  return (
    <JobsWorkspace activeTab="applied">
      <AppliedJobsPage applications={snapshot.applications} />
    </JobsWorkspace>
  );
}
