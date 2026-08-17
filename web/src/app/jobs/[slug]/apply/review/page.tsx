import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { ApplicationDraftService } from "@/backend/candidate-applications/application-draft-service";
import { CandidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import { ApplicationReviewSubmit } from "@/frontend/features/candidate-applications/components/application-review-submit";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateApplicationReviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  const { slug } = await params;
  if (!context) redirect(`/login?returnTo=${encodeURIComponent(`/jobs/${slug}/apply/review`)}`);
  const rawQuery = await searchParams;
  const rawDraftId = rawQuery.draftId;
  const draftId = Array.isArray(rawDraftId) ? rawDraftId[0] : rawDraftId;
  if (!draftId) redirect(`/jobs/${encodeURIComponent(slug)}/apply`);
  let review;
  try {
    review = await new ApplicationDraftService().review(
      { userId: context.userId, sessionId: context.sessionId },
      draftId,
    );
  } catch (error) {
    if (error instanceof CandidateApplicationError && error.status === 404) redirect(`/jobs/${encodeURIComponent(slug)}/apply`);
    throw error;
  }
  if (review.job.slug !== slug) redirect(`/jobs/${encodeURIComponent(review.job.slug)}/apply/review?draftId=${encodeURIComponent(draftId)}`);
  return (
    <JobsWorkspace>
      <ApplicationReviewSubmit slug={slug} review={review} csrfProof={context.csrfProof} />
    </JobsWorkspace>
  );
}
