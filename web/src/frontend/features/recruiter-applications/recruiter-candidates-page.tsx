"use client";

import { useState } from "react";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { CandidateRankingList } from "./candidate-ranking-list";

const visibleStatuses = new Set<RecruiterJob["status"]>(["active", "closed"]);

function applicationLabel(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "candidate" : "candidates"}`;
}

export function RecruiterCandidatesPage({ jobs }: { jobs: RecruiterJob[] }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectableJobs = jobs
    .filter((job) => visibleStatuses.has(job.status))
    .sort(
      (left, right) =>
        right.stats.applicantCount - left.stats.applicantCount ||
        right.updatedAt.localeCompare(left.updatedAt),
    );
  const selectedJob = selectableJobs.find((job) => job.id === selectedJobId);

  if (selectedJob) {
    return (
      <CandidateRankingList
        jobId={selectedJob.id}
        jobTitle={selectedJob.title}
        onBack={() => setSelectedJobId(null)}
      />
    );
  }

  return (
    <section
      className="recruiter-management recruiter-candidates-page"
      aria-labelledby="recruiter-candidates-title"
    >
      <header className="recruiter-management__heading">
        <div>
          <p className="recruiter-eyebrow">Recruiter workspace</p>
          <h1 id="recruiter-candidates-title">Candidates</h1>
          <p>
            Choose a hiring campaign to review applications, CV evidence, and
            advisory scores.
          </p>
        </div>
      </header>

      <div className="ai-ranking-human-banner" role="note">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Scores are visible to recruiters only.</strong>
          <span>
            Automatic and AI scores support review; every hiring decision
            remains with the recruiter.
          </span>
        </div>
      </div>

      {selectableJobs.length === 0 ? (
        <div className="recruiter-empty-state recruiter-surface-card">
          <h2>No hiring campaigns are ready for candidate review.</h2>
          <p>
            Active and closed job postings will appear here after they are
            available to candidates.
          </p>
        </div>
      ) : (
        <div className="recruiter-candidate-campaign-grid" role="list">
          {selectableJobs.map((job) => (
            <article
              className="recruiter-candidate-campaign"
              role="listitem"
              key={job.id}
            >
              <div>
                <span
                  className={`recruiter-candidate-campaign__status is-${job.status}`}
                >
                  {job.status === "active" ? "Active" : "Closed"}
                </span>
                <h2>{job.title || "Untitled job posting"}</h2>
                <p>{job.company.name}</p>
              </div>
              <div className="recruiter-candidate-campaign__footer">
                <strong>{applicationLabel(job.stats.applicantCount)}</strong>
                <button
                  type="button"
                  className="recruiter-primary-button"
                  onClick={() => setSelectedJobId(job.id)}
                  aria-label={`Review candidates for ${job.title || "Untitled job posting"}`}
                >
                  Review candidates
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
