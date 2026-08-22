import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  findEligiblePrivateMatchJob,
  listEligiblePrivateMatchJobs,
  projectPrivateMatchJob,
} from "@/backend/private-cv-match/private-cv-match-service";
import { listCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import { PrivateMatchSetup } from "@/frontend/features/private-cv-match/components/private-match-setup";
import type {
  PrivateMatchSetupCv,
  PrivateMatchSetupJob,
} from "@/frontend/features/private-cv-match/components/private-match-setup";

export type PrivateMatchSetupRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function PrivateMatchSetupRoute({
  searchParams,
}: PrivateMatchSetupRouteProps) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fcv-match-check%2Fnew");

  const params = await searchParams;
  const requestedJobId = Array.isArray(params.jobId)
    ? params.jobId[0]
    : params.jobId;
  const requestedCvVersionId = Array.isArray(params.cvVersionId)
    ? params.cvVersionId[0]
    : params.cvVersionId;
  const [eligibleJobs, cvLibrary] = await Promise.all([
    listEligiblePrivateMatchJobs(),
    listCandidateCvLibrary(context.userId),
  ]);
  // Preserve a valid preselection with at most one additional job query.
  const requestedJob =
    requestedJobId && !eligibleJobs.some((job) => job.id === requestedJobId)
      ? await findEligiblePrivateMatchJob(requestedJobId)
      : null;
  const sourceJobs =
    requestedJob && !eligibleJobs.some((job) => job.id === requestedJob.id)
      ? [requestedJob, ...eligibleJobs]
      : eligibleJobs;
  const jobs: PrivateMatchSetupJob[] = sourceJobs.map(projectPrivateMatchJob);
  const cvs: PrivateMatchSetupCv[] = cvLibrary.items
    .filter(
      (cv): cv is typeof cv & { mimeType: PrivateMatchSetupCv["mimeType"] } =>
        cv.mimeType === "application/pdf" ||
        cv.mimeType === "application/msword" ||
        cv.mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    .map((cv) => ({
      ...cv,
      pageCount: null,
      parseStatus: "READY" as const,
    }));

  return (
    <PrivateMatchSetup
      jobs={jobs}
      cvs={cvs}
      initialJobId={requestedJobId}
      initialCvId={requestedCvVersionId}
    />
  );
}
