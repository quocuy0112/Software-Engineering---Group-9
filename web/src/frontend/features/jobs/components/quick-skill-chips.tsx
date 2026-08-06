import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";
import { jobCategories, jobExpertise, jobSkills } from "./job-detail-data";

export function QuickSkillChips({
  job,
  compact = false,
}: {
  job: JobCard | JobDetail;
  compact?: boolean;
}) {
  const groups = [
    {
      label: "Skills",
      ariaLabel: "Skills",
      items: jobSkills(job).slice(0, compact ? 5 : 12),
    },
    {
      label: "Job expertise",
      ariaLabel: "Job expertise",
      items: jobExpertise(job).slice(0, compact ? 0 : 8),
    },
    {
      label: "Job domain",
      ariaLabel: "Job domain",
      items: jobCategories(job).slice(0, compact ? 0 : 6),
    },
  ];

  return (
    <div className={"job-skill-chip-groups" + (compact ? " is-compact" : "")}>
      {(compact ? groups.slice(0, 1) : groups).map((group) => (
        <div className="job-skill-chip-group" key={group.label}>
          <p className="job-skill-chip-label">{group.label}</p>
          <ul className="job-skill-chip-list" aria-label={group.ariaLabel}>
            {group.items.length ? (
              group.items.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Not listed</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
