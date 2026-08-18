import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateApplicationService } from "@/backend/services/jobs/candidate-application-service";
import { JobServiceError } from "@/backend/services/jobs/job-types";
import { ApplicationDetailPage } from "@/frontend/features/jobs/components/application-detail-page";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubmittedApplicationRoute({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const context = await getWorkspaceContext();
  const { applicationId } = await params;
  const returnTo = `/jobs/applied/${applicationId}/submitted`;

  if (!context) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  let application;
  try {
    application = await new CandidateApplicationService().detail(
      { userId: context.userId, sessionId: context.sessionId },
      applicationId,
    );
  } catch (error) {
    if (error instanceof JobServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <JobsWorkspace>
      <ApplicationDetailPage
        application={application}
        csrfProof={context.csrfProof}
      />
    </JobsWorkspace>
  );
}
