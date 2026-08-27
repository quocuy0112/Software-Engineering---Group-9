"use client";

import { CandidateRankingList } from "./candidate-ranking-list";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

export function RecruiterCandidateWorkspace({
  jobId,
  jobTitle,
  backHref,
  csrfProof,
}: {
  jobId: string;
  jobTitle: string;
  backHref: string;
  csrfProof?: string;
}) {
  const copy = recruiterApplicationsCopy(useWorkspaceLocale()).ranking;
  return (
    <section
      className="recruiter-candidate-workspace"
      aria-label={copy.candidates}
    >
      <CandidateRankingList
        jobId={jobId}
        jobTitle={jobTitle}
        backHref={backHref}
        csrfProof={csrfProof}
        pipelineHref={`/recruiter/pipeline?jobId=${encodeURIComponent(jobId)}`}
      />
    </section>
  );
}
