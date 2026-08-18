"use client";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import type { PrivateMatchJob } from "@/shared/contracts/private-cv-match";

const analysisSteps = [
  ["Read your CV", "Extracted skills, experience and project evidence."],
  ["Understand the job", "Mapped required and preferred qualifications."],
  ["Compare evidence", "Checked each requirement against CV evidence."],
  ["Prepare guidance", "Generated an explainable score and improvement plan."],
] as const;

const employmentTypeLabels: Record<string, string> = {
  CONTRACT: "Contract",
  FULL_TIME: "Full-time",
  INTERNSHIP: "Internship",
  PART_TIME: "Part-time",
  TEMPORARY: "Temporary",
};

const workArrangementLabels: Record<string, string> = {
  HYBRID: "Hybrid",
  ON_SITE: "On-site",
  ONSITE: "On-site",
  REMOTE: "Remote",
};

export function formatEmploymentType(value: string) {
  const normalized = value
    .trim()
    .replace(/[\s-]+/gu, "_")
    .toUpperCase();
  const knownLabel = employmentTypeLabels[normalized];
  if (knownLabel) return knownLabel;
  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatWorkArrangement(value: string) {
  const normalized = value
    .trim()
    .replace(/[\s-]+/gu, "_")
    .toUpperCase();
  const knownLabel = workArrangementLabels[normalized];
  if (knownLabel) return knownLabel;
  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatExperienceRequirement(value: number | null) {
  if (value === null) return "Experience flexible";
  if (value === 0) return "Entry level";
  return `${value}+ years`;
}

export function PrivateMatchStatusBadge({
  state,
}: {
  state: "analyzing" | "completed";
}) {
  const analyzing = state === "analyzing";
  const Icon = analyzing ? LoaderCircle : Clock3;
  return (
    <span
      className={`private-match-status-card ${analyzing ? "private-match-status-card--analyzing" : "private-match-status-card--completed"}`}
      role="status"
    >
      <Icon
        aria-hidden="true"
        className={analyzing ? "private-match-spin" : undefined}
      />
      {analyzing ? "Analysis in progress" : "Completed just now"}
    </span>
  );
}

type PrivateMatchJobSummary = Pick<
  PrivateMatchJob,
  | "title"
  | "company"
  | "location"
  | "employmentType"
  | "requiredExperienceYears"
  | "jdVersion"
>;

export function PrivateMatchJobTags({
  job,
}: {
  job: Pick<PrivateMatchJob, "employmentType" | "requiredExperienceYears">;
}) {
  return (
    <div className="private-match-chip-group private-match-job-tags">
      <span className="private-match-chip private-match-job-tag">
        <Clock3 aria-hidden="true" />
        {formatEmploymentType(job.employmentType)}
      </span>
      <span className="private-match-chip private-match-job-tag">
        <CalendarDays aria-hidden="true" />
        {formatExperienceRequirement(job.requiredExperienceYears)}
      </span>
    </div>
  );
}

export function PrivateMatchSelectedJobCard({
  job,
}: {
  job?: PrivateMatchJobSummary | null;
}) {
  return (
    <section
      className="private-match-card private-match-selected-job-card"
      aria-busy={!job}
    >
      <div className="private-match-card-label">SELECTED JOB</div>
      {job ? (
        <>
          <h2>{job.title}</h2>
          <p>
            {job.company} · {job.location}
          </p>
          <PrivateMatchJobTags job={job} />
          <small className="private-match-sidebar-source">
            SmartHire job post · Version {job.jdVersion}
          </small>
        </>
      ) : (
        <div className="private-match-job-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

export function PrivateMatchPrivacyCard() {
  return (
    <section className="private-match-card private-match-privacy-assurance-card">
      <h2>
        <LockKeyhole aria-hidden="true" /> Private and fair by design
      </h2>
      <ul className="private-match-check-list">
        <li>
          <Check aria-hidden="true" /> Only you can see this report.
        </li>
        <li>
          <Check aria-hidden="true" /> Sensitive personal attributes are
          excluded.
        </li>
        <li>
          <Check aria-hidden="true" /> The report is not sent to recruiters.
        </li>
      </ul>
    </section>
  );
}

export function PrivateMatchStepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const labels = ["Choose job and CV", "Analyze evidence", "Review report"];
  return (
    <ol className="private-match-stepper" aria-label="Assessment steps">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const complete = step < activeStep;
        const active = step === activeStep;
        return (
          <li
            className={
              complete ? "is-complete" : active ? "is-active" : undefined
            }
            aria-current={active ? "step" : undefined}
            key={label}
          >
            <span aria-hidden="true">{complete ? <Check /> : step}</span>
            <div>
              <small>Step {step}</small>
              <strong>{label}</strong>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PrivateMatchAnalysisSteps({
  activeStep = 4,
}: {
  activeStep?: 1 | 2 | 3 | 4;
}) {
  return (
    <ol className="private-match-analysis-list">
      {analysisSteps.map(([title, description], index) => {
        const step = index + 1;
        const allComplete = activeStep === 4;
        const complete = allComplete || step < activeStep;
        const current = !allComplete && activeStep === step;
        return (
          <li
            className={
              complete ? "is-complete" : current ? "is-current" : "is-pending"
            }
            key={title}
          >
            <span className="private-match-analysis-icon" aria-hidden="true">
              {complete ? (
                <Check />
              ) : current ? (
                <LoaderCircle className="private-match-spin" />
              ) : (
                <Clock3 />
              )}
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
            <span
              className={`private-match-badge ${complete ? "private-match-badge--green" : current ? "private-match-badge--blue" : ""}`}
            >
              {complete ? (
                <CheckCircle2 aria-hidden="true" />
              ) : current ? (
                <LoaderCircle
                  className="private-match-spin"
                  aria-hidden="true"
                />
              ) : (
                <Clock3 aria-hidden="true" />
              )}
              {complete ? "Complete" : current ? "In progress" : "Next"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
