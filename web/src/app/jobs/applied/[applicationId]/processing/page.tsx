import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateApplicationTrackingService } from "@/backend/candidate-applications/candidate-application-tracking-service";
import { CandidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import { ApplicationProcessing } from "@/frontend/features/candidate-applications/components/application-processing";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApplicationProcessingRoute({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const context = await getWorkspaceContext();
  const { applicationId } = await params;
  if (!context) redirect(`/login?returnTo=${encodeURIComponent(`/jobs/applied/${applicationId}/processing`)}`);
  let tracker;
  try {
    tracker = await new CandidateApplicationTrackingService().get(
      { userId: context.userId, sessionId: context.sessionId },
      applicationId,
    );
  } catch (error) {
    if (error instanceof CandidateApplicationError && error.status === 404) notFound();
    throw error;
  }
  return <JobsWorkspace><ApplicationProcessing initialTracker={tracker} csrfProof={context.csrfProof} /></JobsWorkspace>;
}
