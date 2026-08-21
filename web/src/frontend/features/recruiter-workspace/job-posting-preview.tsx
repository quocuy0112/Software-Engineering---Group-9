import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import { formatRecruiterSalary } from "@/shared/contracts/recruiter-job-posting";
import type { JobCatalogItem } from "@/shared/contracts/jobs/catalog";
import { Banknote } from "lucide-react";
import { titleCase } from "./job-posting-editor-options";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterJobPostingCopy } from "./recruiter-job-posting-copy";

export function JobPostingPreview({
  companyName,
  job,
}: {
  companyName: string;
  job: JobCatalogItem;
}) {
  const copy = recruiterJobPostingCopy(useWorkspaceLocale());
  const salaryLine = formatRecruiterSalary(job.salary);

  return (
    <aside
      className="recruiter-preview recruiter-surface-card"
      aria-live="polite"
    >
      <div className="recruiter-preview__heading">
        <span className="recruiter-preview__live-dot" aria-hidden="true" />
        <div className="recruiter-preview__heading-copy">
          <p>{copy.livePreview}</p>
          <strong>{copy.livePreviewHelp}</strong>
        </div>
        <span className="recruiter-preview__live-status">
          {copy.livePreviewStatus}
        </span>
      </div>

      <div className="recruiter-preview__company-row">
        <CompanyAvatar name={companyName} size="md" />
        <div className="recruiter-preview__company-copy">
          <p className="recruiter-preview__company">{companyName}</p>
          <span>
            {job.industry}
            {job.location.city ? ` · ${job.location.city}` : ""}
          </span>
        </div>
      </div>

      <h2>{job.title || copy.yourJobTitle}</h2>

      {salaryLine || job.salary.isNegotiable ? (
        <div className="recruiter-preview__salary">
          <Banknote aria-hidden="true" />
          <strong>{salaryLine ?? copy.negotiable}</strong>
          {job.salary.isNegotiable && salaryLine ? (
            <span>{copy.negotiable}</span>
          ) : null}
        </div>
      ) : null}

      <div className="recruiter-preview__meta-chips">
        <span>{job.experience.label}</span>
        <span>{titleCase(job.level)}</span>
        <span>{titleCase(job.employmentType)}</span>
        <span>{titleCase(job.workArrangement)}</span>
      </div>

      <p className="recruiter-preview__pitch">
        {job.shortPitch || copy.noPitch}
      </p>

      <section className="recruiter-preview__summary-section">
        <h3>{copy.aboutRole}</h3>
        <p>{job.description.overview || copy.noOverview}</p>
      </section>

      <section className="recruiter-preview__summary-section">
        <h3>{copy.requiredSkills}</h3>
        {job.skillTags.length ? (
          <div className="recruiter-preview__skills">
            {job.skillTags.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        ) : (
          <p>{copy.noSkills}</p>
        )}
      </section>

      <section className="recruiter-preview__facts recruiter-preview__summary-section">
        <h3>{copy.hiringSpecs}</h3>
        <dl>
          <div>
            <dt>{copy.experience}</dt>
            <dd>
              {copy.experienceDetail(
                job.experience.label,
                job.experience.minYears,
              )}
            </dd>
          </div>
          <div>
            <dt>{copy.education}</dt>
            <dd>{job.education}</dd>
          </div>
          <div>
            <dt>{copy.openSeats}</dt>
            <dd>{copy.openPositions(job.numberOfHires)}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}
