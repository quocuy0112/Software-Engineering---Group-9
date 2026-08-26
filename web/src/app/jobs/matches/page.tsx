import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  isJobPreferencesConfigured,
  readJobWorkspaceSnapshot,
  suggestedJobsForSnapshot,
} from "@/backend/services/jobs/job-workspace-data";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";
import { SuggestedJobsPage } from "@/frontend/features/jobs/components/suggested-jobs-page";
import {
  filterWorkspaceJobs,
  workspaceJobSearchCriteria,
} from "@/backend/services/jobs/job-workspace-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuggestedJobsRoute({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fmatches");
  const [snapshot, rawCriteria] = await Promise.all([
    readJobWorkspaceSnapshot(context.userId),
    searchParams,
  ]);
  const criteria = workspaceJobSearchCriteria(rawCriteria);
  return (
    <JobsWorkspace activeTab="matches">
      <SuggestedJobsPage
        jobs={filterWorkspaceJobs(suggestedJobsForSnapshot(snapshot), criteria)}
        preferencesConfigured={isJobPreferencesConfigured(
          snapshot.state.jobPreferences,
        )}
      />
    </JobsWorkspace>
  );
}
