"use client";

import Link from "next/link";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { JobApplicationAction } from "./job-application-form";
import { CompanyAvatar } from "./company-avatar";
import { JobOverflowMenu } from "./job-overflow-menu";
import { SaveJobAction } from "./save-job-action";

const labels: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ENTRY: "Entry level",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

function salary(value: JobCard["salary"]) {
  if (!value) return "Salary not disclosed";
  const format = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: 0,
  });
  return (
    format.format(value.minimum) +
    " – " +
    format.format(value.maximum) +
    " / " +
    value.period.toLowerCase()
  );
}

const jobDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function SignInApplyLink({ job }: { job: JobCard }) {
  return (
    <Link
      className="sh-button job-card-apply-button"
      href={"/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)}
    >
      Apply now
    </Link>
  );
}

export function JobCardView({
  job,
  onQuickView,
}: {
  job: JobCard;
  onQuickView?: () => void;
}) {
  return (
    <article
      className="job-card job-redesign-card"
      aria-labelledby={"job-" + job.id}
    >
      <header className="job-redesign-card-header">
        <div className="job-card-identity">
          <CompanyAvatar
            name={job.company.displayName}
            imageUrl={job.company.logoUrl}
            size="md"
            className="job-company-monogram"
          />
          <div>
            <p className="job-company-name">{job.company.displayName}</p>
            <h2 id={"job-" + job.id}>
              <Link href={"/jobs/" + job.slug}>{job.title}</Link>
            </h2>
          </div>
        </div>
        <div className="job-card-badges">
          {job.isUrgent ? (
            <span className="job-urgent-badge">Urgent</span>
          ) : null}
          <span className="job-card-arrangement">
            {labels[job.workArrangement] ?? job.workArrangement}
          </span>
        </div>
      </header>

      <div className="job-redesign-card-meta">
        <span>
          <span aria-hidden="true">⌖</span>
          {job.location}
        </span>
        <span>
          <span aria-hidden="true">◫</span>
          {labels[job.employmentType] ?? job.employmentType}
        </span>
        <span>
          <span aria-hidden="true">◷</span>
          {labels[job.experienceLevel] ?? job.experienceLevel}
        </span>
        {job.matchScore !== undefined ? (
          <span className="job-match-badge">{job.matchScore}% match</span>
        ) : null}
      </div>

      <div className="job-card-highlight-row">
        <p className="job-salary">{salary(job.salary)}</p>
        <p className="job-card-timing">
          Posted {jobDate.format(new Date(job.publishedAt))}
          {job.applicationDeadline
            ? " · Apply by " + jobDate.format(new Date(job.applicationDeadline))
            : ""}
        </p>
      </div>

      <p className="job-summary">{job.summary}</p>
      <ul className="job-skills" aria-label="Skills">
        {job.skills.slice(0, 5).map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>

      <footer className="job-redesign-card-footer">
        <div
          className="job-card-primary-actions"
          aria-label="Primary job actions"
        >
          {job.actions.authenticated && job.actions.canApply ? (
            <JobApplicationAction
              jobId={job.id}
              jobSlug={job.slug}
              initialApplied={job.actions.applied}
            />
          ) : job.actions.applied ? (
            <span className="job-applied-state">✓ Đã ứng tuyển</span>
          ) : job.actions.canApply ? (
            <SignInApplyLink job={job} />
          ) : (
            <span className="job-closed-state">Applications closed</span>
          )}
          {job.actions.authenticated && job.actions.canSave ? (
            <SaveJobAction
              jobId={job.id}
              initialSaved={job.actions.saved}
              initialApplied={job.actions.applied}
              variant="icon"
            />
          ) : (
            <Link
              className="job-icon-button"
              href={
                "/login?returnTo=" + encodeURIComponent("/jobs/" + job.slug)
              }
              aria-label="Sign in to save this job"
            >
              ♡
            </Link>
          )}
        </div>
        {onQuickView ? (
          <JobOverflowMenu
            jobId={job.id}
            seed={{
              saved: job.actions.saved,
              applied: job.actions.applied,
            }}
            onQuickView={onQuickView}
          />
        ) : null}
      </footer>
    </article>
  );
}
