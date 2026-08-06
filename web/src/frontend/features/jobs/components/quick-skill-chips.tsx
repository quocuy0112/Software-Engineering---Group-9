import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";
import { jobSkills } from "./job-detail-data";

export function QuickSkillChips({
  job,
  compact = false,
}: {
  job: JobCard | JobDetail;
  compact?: boolean;
}) {
  const items = jobSkills(job).slice(0, compact ? 6 : 14);

  return (
    <section
      className={"job-skill-chip-groups" + (compact ? " is-compact" : "")}
      aria-labelledby={compact ? undefined : "job-skills-heading"}
    >
      <div className="job-skill-chip-group">
        <p
          className="job-skill-chip-label"
          id={compact ? undefined : "job-skills-heading"}
        >
          Required skills
        </p>
        <ul className="job-skill-chip-list" aria-label="Required skills">
          {items.length ? (
            items.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>Not listed</li>
          )}
        </ul>
      </div>
    </section>
  );
}
