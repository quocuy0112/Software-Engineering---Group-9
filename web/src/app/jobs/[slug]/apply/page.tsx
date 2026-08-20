import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { ApplicationDraftService } from "@/backend/candidate-applications/application-draft-service";
import { CandidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import { listCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import { ApplicationWizard } from "@/frontend/features/candidate-applications/components/application-wizard";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateApplicationRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  const { slug } = await params;
  if (!context)
    redirect(`/login?returnTo=${encodeURIComponent(`/jobs/${slug}/apply`)}`);
  const rawQuery = await searchParams;
  const query = (name: string) => {
    const value = rawQuery[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const service = new ApplicationDraftService();
  const job = await service.jobBySlug(slug);
  if (!job) notFound();
  let draft;
  try {
    draft = await service.getOrCreate(
      { userId: context.userId, sessionId: context.sessionId },
      job.id,
      new Date(),
      query("cvVersionId") ?? null,
    );
  } catch (error) {
    if (
      error instanceof CandidateApplicationError &&
      error.code === "APPLICATION_EXISTS"
    ) {
      const existing = await service.existingApplication(
        { userId: context.userId, sessionId: context.sessionId },
        job.id,
      );
      if (existing)
        redirect(`/jobs/applied/${encodeURIComponent(existing.id)}`);
    }
    throw error;
  }
  const cvs = await listCandidateCvLibrary(context.userId);
  const step = query("step") === "2" ? (2 as const) : (1 as const);
  const coverLetterNeedsReupload = query("recover") === "cover-letter";
  return (
    <JobsWorkspace>
      <ApplicationWizard
        slug={slug}
        job={{
          id: job.id,
          title: job.title,
          companyName: job.company.displayName,
          location: job.location,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          workArrangement: job.workArrangement,
          applicationDeadline: job.applicationDeadline?.toISOString() ?? null,
        }}
        initialDraft={draft}
        initialCvs={cvs.items}
        csrfProof={context.csrfProof}
        initialStep={step}
        coverLetterNeedsReupload={coverLetterNeedsReupload}
      />
    </JobsWorkspace>
  );
}
