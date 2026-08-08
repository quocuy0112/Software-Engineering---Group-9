import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";
import { SavedJobsPage } from "@/frontend/features/jobs/components/saved-jobs-page";
import { readJobWorkspaceSnapshot } from "@/backend/services/jobs/job-workspace-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavedJobsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fsaved");
  const snapshot = await readJobWorkspaceSnapshot(context.userId);
  return (
    <JobsWorkspace activeTab="saved">
      <SavedJobsPage jobs={snapshot.savedJobs} />
    </JobsWorkspace>
  );
}
