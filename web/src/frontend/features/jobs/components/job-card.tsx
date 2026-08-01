import Link from "next/link";
import type { JobCard } from "@/shared/contracts/jobs/discovery";
import { SaveJobAction } from "./save-job-action";

const labels: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
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

export function JobCardView({ job }: { job: JobCard }) {
  return (
    <article className="job-card" aria-labelledby={`job-${job.id}`}>
      <p>{job.company.displayName}</p>
      <h2 id={`job-${job.id}`}>
        <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
      </h2>
      <div className="job-meta">
        <span>{job.location}</span>
        <span>{labels[job.employmentType]}</span>
        <span>{labels[job.workArrangement]}</span>
      </div>
      <p>{salary(job.salary)}</p>
      <p>{job.summary}</p>
      <p aria-label="Skills">{job.skills.join(" · ")}</p>
      {job.actions.authenticated && job.actions.canSave ? (
        <SaveJobAction jobId={job.id} initialSaved={job.actions.saved} />
      ) : (
        <Link
          href={`/login?returnTo=${encodeURIComponent(`/jobs/${job.slug}`)}`}
        >
          Sign in to save
        </Link>
      )}
    </article>
  );
}
