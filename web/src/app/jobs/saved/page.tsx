import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";
import { SavedJobsPage } from "@/frontend/features/jobs/components/saved-jobs-page";
import { readJobWorkspaceSnapshot } from "@/backend/services/jobs/job-workspace-data";
import {
  filterWorkspaceJobs,
  workspaceJobSearchCriteria,
} from "@/backend/services/jobs/job-workspace-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SavedJobsRoute({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fsaved");
  const [snapshot, rawCriteria] = await Promise.all([
    readJobWorkspaceSnapshot(context.userId),
    searchParams,
  ]);
  const criteria = workspaceJobSearchCriteria(rawCriteria);
  return (
    <JobsWorkspace activeTab="saved">
      <SavedJobsPage jobs={filterWorkspaceJobs(snapshot.savedJobs, criteria)} />
    </JobsWorkspace>
  );
}
