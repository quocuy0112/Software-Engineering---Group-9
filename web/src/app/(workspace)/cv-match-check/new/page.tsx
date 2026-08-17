import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  findEligiblePrivateMatchJob,
  listEligiblePrivateMatchJobs,
} from "@/backend/private-cv-match/private-cv-match-service";
import { listCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import { PrivateMatchSetup } from "@/frontend/features/private-cv-match/components/private-match-setup";
import type {
  PrivateMatchSetupCv,
  PrivateMatchSetupJob,
} from "@/frontend/features/private-cv-match/components/private-match-setup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CvMatchCheckNewPage({ searchParams }: PageProps) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fcv-match-check%2Fnew");
  const params = await searchParams;
  const requestedJobId = Array.isArray(params.jobId)
    ? params.jobId[0]
    : params.jobId;
  const requestedCvVersionId = Array.isArray(params.cvVersionId)
    ? params.cvVersionId[0]
    : params.cvVersionId;
  const [eligibleJobs, requestedJob, cvLibrary] = await Promise.all([
    listEligiblePrivateMatchJobs(),
    // The setup selector is intentionally bounded, but a job detail page may
    // point at an older job outside that window. Resolve the requested ID
    // separately so opening a valid job never silently becomes unavailable.
    requestedJobId
      ? findEligiblePrivateMatchJob(requestedJobId)
      : Promise.resolve(null),
    listCandidateCvLibrary(context.userId),
  ]);
  const sourceJobs =
    requestedJob && !eligibleJobs.some((job) => job.id === requestedJob.id)
      ? [requestedJob, ...eligibleJobs]
      : eligibleJobs;
  const jobs: PrivateMatchSetupJob[] = sourceJobs.map((job) => ({
    jobId: job.id,
    slug: job.slug,
    title: job.title,
    company: job.company.displayName,
    location: job.location,
    employmentType: String(job.employmentType),
    workArrangement: String(job.workArrangement),
    requiredExperienceYears:
      (
        {
          ENTRY: 0,
          JUNIOR: 1,
          MID: 3,
          SENIOR: 5,
          LEAD: 7,
          MANAGER: 5,
        } as Record<string, number | undefined>
      )[job.experienceLevel] ?? null,
    requirements: [
      ...job.skills.map((skill) => skill.displayName),
      ...job.requirements.split(/\r?\n|[•·]/u),
      ...job.responsibilities.split(/\r?\n|[•·]/u),
    ]
      .map((value) => value.replace(/^[-*\d.)\s]+/u, "").trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 12),
  }));
  const cvs: PrivateMatchSetupCv[] = cvLibrary.items
    .filter(
      (cv): cv is typeof cv & { mimeType: PrivateMatchSetupCv["mimeType"] } =>
        cv.mimeType === "application/pdf" ||
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
