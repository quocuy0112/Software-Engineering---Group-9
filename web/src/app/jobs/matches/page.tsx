import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  isJobPreferencesConfigured,
  readJobWorkspaceSnapshot,
  suggestedJobsForSnapshot,
} from "@/backend/services/jobs/job-workspace-data";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";
import { SuggestedJobsPage } from "@/frontend/features/jobs/components/suggested-jobs-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuggestedJobsRoute() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fmatches");
  const snapshot = await readJobWorkspaceSnapshot(context.userId);
  return (
    <JobsWorkspace activeTab="matches">
      <SuggestedJobsPage
        jobs={suggestedJobsForSnapshot(snapshot)}
        preferencesConfigured={isJobPreferencesConfigured(
          snapshot.state.jobPreferences,
        )}
      />
    </JobsWorkspace>
  );
}
