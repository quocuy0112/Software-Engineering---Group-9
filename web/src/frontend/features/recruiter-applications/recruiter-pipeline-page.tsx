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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

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
  const copy = recruiterApplicationsCopy(useWorkspaceLocale()).pipeline;
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
      aria-label={copy.title}
    >
      <PageHeader
        className="pipeline-page-heading"
        eyebrow={copy.workspace}
        title={copy.title}
        subtitle={copy.subtitle}
      />
      <div className="job-bar pipeline-job-selector recruiter-surface-card">
        <div className="pipeline-job-selector__copy">
          <div className="job-bar-label">
            <BriefcaseBusiness aria-hidden="true" />
            {copy.jobPosting}
          </div>
          <div className="job-bar-sub">{copy.selectDescription}</div>
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
              {copy.jobPosting}
            </span>
            <span className="dot" aria-hidden="true" />
            <select
              id="pipeline-job-select"
              value={selectedJobId ?? ""}
              onChange={(event) => selectJob(event.target.value)}
              aria-describedby="pipeline-job-select-help"
            >
              <option value="">{copy.chooseJob}</option>
              {/*
            {managedJobs.map((job) => (
              <option value={job.id} key={job.id}>
                {job.title || "Untitled job posting"} · {job.status === "active" ? "Active" : "Closed"}
              </option>
            ))}
            */}
              {managedJobs.map((job) => (
                <option value={job.id} key={job.id}>
                  {job.title || copy.untitledJob} {"\u00b7"}{" "}
                  {job.status === "active" ? copy.active : copy.closed}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
        <span id="pipeline-job-select-help" className="sr-only">
          {selectedJob
            ? copy.showingPipeline(selectedJob.title)
            : copy.selectJob}
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
            <h2>{copy.noJobsTitle}</h2>
            <p>{copy.noJobsDescription}</p>
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
            {copy.createJob}
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
            <h2>{copy.selectJobTitle}</h2>
            <p>{copy.selectJobDescription}</p>
          </div>
        </div>
      ) : (
        <RecruitmentPipelineBoard key={selectedJob.id} jobId={selectedJob.id} />
      )}
    </section>
  );
}
