import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateApplicationService } from "@/backend/services/jobs/candidate-application-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { ApplicationDetailPage } from "@/frontend/features/jobs/components/application-detail-page";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadApplication(
  context: { userId: string; sessionId: string },
  applicationId: string,
) {
  try {
    return await new CandidateApplicationService().detail(
      context,
      applicationId,
    );
  } catch (error) {
    if (error instanceof JobServiceError && error.status === 404) notFound();
    throw error;
  }
}

export default async function CandidateApplicationDetailRoute({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const context = await getWorkspaceContext();
  const applicationId = (await params).applicationId;
  if (!context) {
    redirect(
      `/login?returnTo=${encodeURIComponent(`/jobs/applied/${applicationId}`)}`,
    );
  }

  const application = await loadApplication(
    { userId: context.userId, sessionId: context.sessionId },
    applicationId,
  );
  return (
    <JobsWorkspace activeTab="applied">
      <ApplicationDetailPage
        application={application}
        csrfProof={context.csrfProof}
      />
    </JobsWorkspace>
  );
}
