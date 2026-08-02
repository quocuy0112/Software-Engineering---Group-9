import Link from "next/link";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
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
  return `${format.format(value.minimum)} – ${format.format(value.maximum)} / ${value.period.toLowerCase()}`;
}

const jobDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function JobCardView({ job }: { job: JobCard }) {
  return (
    <article className="job-card" aria-labelledby={`job-${job.id}`}>
      <header className="job-card-header">
        <div>
          <p className="job-company-name">{job.company.displayName}</p>
          <h2 id={`job-${job.id}`}>
            <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
          </h2>
        </div>
        <span className="job-card-arrangement">
          {labels[job.workArrangement]}
        </span>
      </header>
      <div className="job-meta">
        <span>{job.location}</span>
        <span>{labels[job.employmentType]}</span>
        <span>{labels[job.experienceLevel]}</span>
      </div>
      <p className="job-salary">{salary(job.salary)}</p>
      <p className="job-card-timing">
        Posted {jobDate.format(new Date(job.publishedAt))}
        {job.applicationDeadline
          ? ` · Apply by ${jobDate.format(new Date(job.applicationDeadline))}`
          : ""}
      </p>
      <p className="job-summary">{job.summary}</p>
      <ul className="job-skills" aria-label="Skills">
        {job.skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
      <footer className="job-card-footer">
        <Link className="job-primary-link" href={`/jobs/${job.slug}`}>
          View details
        </Link>
        {job.actions.authenticated && job.actions.canSave ? (
          <SaveJobAction jobId={job.id} initialSaved={job.actions.saved} />
        ) : (
          <Link
            className="job-secondary-link"
            href={`/login?returnTo=${encodeURIComponent(`/jobs/${job.slug}`)}`}
          >
            Sign in to save
          </Link>
        )}
      </footer>
    </article>
  );
}
