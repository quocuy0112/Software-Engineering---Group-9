import Link from "next/link";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { JobApplicationAction } from "./job-application-form";
import { SaveJobAction } from "./save-job-action";
import { ReportJobDialog } from "./report-job-dialog";

const stateLabel = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  EXPIRED: "Expired",
} as const;
const valueLabel: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ENTRY: "Entry",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

function salary(job: JobDetail) {
  if (!job.salary) return "Salary not disclosed";
  const number = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: job.salary.currency,
    maximumFractionDigits: 0,
  });
  return `${number.format(job.salary.minimum)} – ${number.format(job.salary.maximum)} per ${job.salary.period.toLowerCase()}`;
}

export function JobDetailView({ job }: { job: JobDetail }) {
  const returnTo = encodeURIComponent(`/jobs/${job.slug}`);
  return (
    <article className="job-panel">
      <header>
        <p>{job.company.displayName}</p>
        <h1>{job.title}</h1>
        <span
          className="job-state"
          aria-label={`Job status: ${stateLabel[job.state]}`}
        >
          {stateLabel[job.state]}
        </span>
        <div className="job-meta">
          <span>{job.location}</span>
          <span>{valueLabel[job.employmentType]}</span>
          <span>{valueLabel[job.experienceLevel]}</span>
          <span>{valueLabel[job.workArrangement]}</span>
        </div>
        <p>{salary(job)}</p>
      </header>
      <section aria-labelledby="job-description">
        <h2 id="job-description">About the role</h2>
        <p>{job.description}</p>
      </section>
      <section aria-labelledby="job-responsibilities">
        <h2 id="job-responsibilities">Responsibilities</h2>
        <p>{job.responsibilities}</p>
      </section>
      <section aria-labelledby="job-requirements">
        <h2 id="job-requirements">Requirements</h2>
        <p>{job.requirements}</p>
        <p>{job.skills.join(" · ")}</p>
      </section>
      {job.benefits ? (
        <section aria-labelledby="job-benefits">
          <h2 id="job-benefits">Benefits</h2>
          <p>{job.benefits}</p>
        </section>
      ) : null}
      {job.company.publicDescription ? (
        <section aria-labelledby="job-company">
          <h2 id="job-company">About {job.company.displayName}</h2>
          <p>{job.company.publicDescription}</p>
        </section>
      ) : null}
      <div className="job-actions" aria-label="Job actions">
        {job.state === "ACTIVE" && job.actions.canApply ? (
          job.actions.authenticated ? (
            <JobApplicationAction jobId={job.id} />
          ) : (
            <Link href={`/login?returnTo=${returnTo}`}>Sign in to apply</Link>
          )
        ) : null}
        {job.actions.authenticated && job.actions.canSave ? (
          <SaveJobAction jobId={job.id} initialSaved={job.actions.saved} />
        ) : null}
        {job.actions.authenticated && job.actions.canReport ? (
          <ReportJobDialog jobId={job.id} />
        ) : null}
        {!job.actions.authenticated ? (
          <Link href={`/login?returnTo=${returnTo}`}>
            Sign in to save or report
          </Link>
        ) : null}
        <Link href="/jobs">Back to jobs</Link>
      </div>
    </article>
  );
}
