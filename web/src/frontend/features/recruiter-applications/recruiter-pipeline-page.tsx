"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, Inbox, Plus } from "lucide-react";
import { PageHeader } from "@/frontend/components/layout/page-header";
import type {
  RecruiterCompanyView,
  RecruiterJob,
} from "@/shared/contracts/recruiter-job-posting";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import { RecruitmentPipelineBoard } from "./recruitment-pipeline-board";
import { RecruiterCompanyFilter } from "@/frontend/features/recruiter-workspace/recruiter-company-filter";
import {
  companyMatchesScope,
  useRecruiterCompanyScope,
} from "@/frontend/features/recruiter-workspace/recruiter-company-scope";

const emptyCompanies: RecruiterCompanyView[] = [];

function mostRecentlyActiveJob(jobs: readonly RecruiterJob[]) {
  return (
    jobs
      .filter((job) => job.status === "active")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      ?.id ?? null
  );
}

export function RecruiterPipelinePage({
  jobs,
  companies,
  initialJobId,
}: {
  jobs: RecruiterJob[];
  companies?: RecruiterCompanyView[];
  initialJobId?: string;
}) {
  const companyOptions = companies ?? emptyCompanies;
  const { companyId, selectedCompanyId, setCompanyId } =
    useRecruiterCompanyScope(companyOptions);
  const scopedJobs = useMemo(
    () =>
      jobs.filter((job) =>
        companyMatchesScope(job.companyId, selectedCompanyId),
      ),
    [jobs, selectedCompanyId],
  );
  const managedJobs = useMemo(
    () =>
      scopedJobs.filter(
        (job) => job.status === "active" || job.status === "closed",
      ),
    [scopedJobs],
  );
  const requestedJob = initialJobId
    ? managedJobs.find((job) => job.id === initialJobId)?.id
    : undefined;
  const [selectedJobIdState, setSelectedJobId] = useState<string | null>(
    requestedJob ?? mostRecentlyActiveJob(managedJobs),
  );
  const selectedJobId = useMemo(() => {
    if (
      selectedJobIdState &&
      managedJobs.some((job) => job.id === selectedJobIdState)
    ) {
      return selectedJobIdState;
    }
    return mostRecentlyActiveJob(managedJobs);
  }, [managedJobs, selectedJobIdState]);
  const selectedJob =
    managedJobs.find((job) => job.id === selectedJobId) ?? null;

  const selectJob = (jobId: string) => {
    const next = managedJobs.find((job) => job.id === jobId);
    if (!next) {
      setSelectedJobId(null);
      return;
    }
    setSelectedJobId(next.id);
    window.history.replaceState(
      null,
      "",
      recruiterRoutes.pipelineForJob(next.id),
    );
  };

  return (
    <section
      className="page recruiter-management recruiter-pipeline-page"
      aria-label="Recruiter pipeline"
    >
      <PageHeader
        className="pipeline-page-heading"
        eyebrow="Recruiter workspace"
        title="Candidate pipeline"
        subtitle="Review candidate progress across each stage of your hiring workflow."
      />
      <div className="job-bar pipeline-job-selector recruiter-surface-card">
        <div className="pipeline-job-selector__copy">
          <div className="job-bar-label">
            <BriefcaseBusiness aria-hidden="true" />
            Job posting
          </div>
          <div className="job-bar-sub">
            Select one managed job to view its candidate pipeline.
          </div>
        </div>
        <div className="pipeline-job-selector__controls">
          <RecruiterCompanyFilter
            companies={companyOptions}
            value={companyId}
            onChange={setCompanyId}
            id="pipeline-company-select"
            className="job-select pipeline-job-selector__control"
          />
          <label
            className="job-select pipeline-job-selector__control"
            htmlFor="pipeline-job-select"
          >
            <span className="pipeline-job-selector__field-label">
              Job posting
            </span>
            <span className="dot" aria-hidden="true" />
            <select
              id="pipeline-job-select"
              value={selectedJobId ?? ""}
              onChange={(event) => selectJob(event.target.value)}
              aria-describedby="pipeline-job-select-help"
            >
              <option value="">Choose a job posting</option>
              {/*
            {managedJobs.map((job) => (
              <option value={job.id} key={job.id}>
                {job.title || "Untitled job posting"} · {job.status === "active" ? "Active" : "Closed"}
              </option>
            ))}
            */}
              {managedJobs.map((job) => (
                <option value={job.id} key={job.id}>
                  {job.title || "Untitled job posting"} {"\u00b7"}{" "}
                  {job.status === "active" ? "Active" : "Closed"}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
        <span id="pipeline-job-select-help" className="sr-only">
          {selectedJob
            ? `Showing the pipeline for ${selectedJob.title}.`
            : "Select a job to load its pipeline."}
        </span>
      </div>

      {!managedJobs.length ? (
        <div
          className="pipeline-page-empty recruiter-surface-card"
          role="status"
        >
          <div className="pipeline-page-empty__ghost" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="pipeline-page-empty__icon" aria-hidden="true">
            <Inbox />
          </span>
          <div className="pipeline-page-empty__content">
            <h2>No job postings available</h2>
            <p>
              Create or publish a job posting before opening its candidate
              evaluation pipeline.
            </p>
          </div>
          <Link
            className="pipeline-page-empty__action"
            href={
              selectedCompanyId
                ? recruiterRoutes.jobPostingCreateForCompany(selectedCompanyId)
                : recruiterRoutes.jobPostingCreate
            }
          >
            <Plus aria-hidden="true" />
            Create a job posting
          </Link>
        </div>
      ) : !selectedJob ? (
        <div
          className="pipeline-page-empty recruiter-surface-card"
          role="status"
        >
          <div className="pipeline-page-empty__ghost" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="pipeline-page-empty__icon" aria-hidden="true">
            <Inbox />
          </span>
          <div className="pipeline-page-empty__content">
            <h2>Select a job posting</h2>
            <p>Choose a job above to see its candidates grouped by stage.</p>
          </div>
        </div>
      ) : (
        <RecruitmentPipelineBoard key={selectedJob.id} jobId={selectedJob.id} />
      )}
    </section>
  );
}
