import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobSkills } from "./job-detail-data";
import { jobCopy } from "./job-copy";

export function QuickSkillChips({
  job,
  compact = false,
}: {
  job: JobCard | JobDetail;
  compact?: boolean;
}) {
  const copy = jobCopy(useWorkspaceLocale());
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
          {copy.requiredSkills}
        </p>
        <ul className="job-skill-chip-list" aria-label={copy.requiredSkills}>
          {items.length ? (
            items.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>{copy.noSkillsListed}</li>
          )}
        </ul>
      </div>
    </section>
  );
}
