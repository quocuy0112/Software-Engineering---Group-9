"use client";

import { CandidateRankingList } from "./candidate-ranking-list";

export function RecruiterCandidateWorkspace({ jobId, jobTitle, backHref, csrfProof }: { jobId: string; jobTitle: string; backHref: string; csrfProof?: string }) {
  return (
    <section className="recruiter-candidate-workspace" aria-label="Candidate list view">
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
