import { Badge } from "@/frontend/components/ui/badge";
import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import { formatRecruiterSalary } from "@/shared/contracts/recruiter-job-posting";
import type { JobCatalogItem } from "@/shared/contracts/jobs/catalog";
import { benefitOptions, titleCase } from "./job-posting-editor-options";

function PreviewList({ items }: { items: string[] }) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean);
  return visibleItems.length ? (
    <ul className="recruiter-preview-list">
      {visibleItems.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  ) : null;
}

export function JobPostingPreview({
  companyName,
  job,
}: {
  companyName: string;
  job: JobCatalogItem;
}) {
  const department = job.description.generalInfo.department ?? "";
  const topReasons = job.description.topReasonsToJoin
    .filter(Boolean)
    .slice(0, 3);
  const salaryLine = formatRecruiterSalary(job.salary);
  const previewLocation = job.location.isNationwideRemote
    ? "Remote across Vietnam"
    : [job.location.city, job.location.district].filter(Boolean).join(", ") ||
      "Location not set";

  return (
    <aside
      className="recruiter-preview recruiter-surface-card"
      aria-live="polite"
    >
      <div className="recruiter-preview__heading">
        <span className="recruiter-feature-icon" aria-hidden="true">
          JP
        </span>
        <div>
          <p>Live candidate preview</p>
          <strong>Mirrors all structured job data</strong>
        </div>
      </div>

      <div className="recruiter-preview__company-row">
        <CompanyAvatar name={companyName} size="md" />
        <div>
          <p className="recruiter-preview__company">{companyName}</p>
          <span>
            {job.industry}
            {job.subIndustry ? ` · ${job.subIndustry}` : ""}
          </span>
        </div>
        {job.isUrgent ? <Badge tone="warning">Urgent hiring</Badge> : null}
      </div>

      <h2>{job.title || "Your job title"}</h2>
      <p className="recruiter-preview__location">
        {department || job.categoryFamily || "Your department"} ·{" "}
        {previewLocation}
      </p>

      {salaryLine ? (
        <div className="recruiter-preview__salary">
          <strong>{salaryLine}</strong>
          {job.salary.isNegotiable ? <span>Negotiable</span> : null}
        </div>
      ) : null}

      <div className="recruiter-preview__meta-chips">
        <span>{job.experience.label}</span>
        <span>{titleCase(job.level)}</span>
        <span>{titleCase(job.employmentType)}</span>
        <span>{titleCase(job.workArrangement)}</span>
      </div>

      <p className="recruiter-preview__pitch">
        {job.shortPitch || "Your short pitch will appear here."}
      </p>

      {job.skillTags.length ? (
        <div className="recruiter-job-card__chips">
          {job.skillTags.map((skill) => (
            <span className="recruiter-skill-chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      {topReasons.length ? (
        <section className="recruiter-preview__highlight">
          <h3>Top reasons to join</h3>
          <PreviewList items={topReasons} />
        </section>
      ) : null}

      <hr />
      <section>
        <h3>About the role</h3>
        <p>
          {job.description.overview ||
            "Your overview will appear here as you complete the form."}
        </p>
      </section>

      {job.description.responsibilities.length ? (
        <section>
          <h3>What you will do</h3>
          <PreviewList items={job.description.responsibilities} />
        </section>
      ) : null}

      {job.description.requirements.length ? (
        <section>
          <h3>Requirements</h3>
          <PreviewList items={job.description.requirements} />
        </section>
      ) : null}

      <section>
        <h3>Required skills</h3>
        <p>
          {job.skillTags.length
            ? job.skillTags.join(", ")
            : "Add skills to show candidates what success looks like."}
        </p>
        <h3>Preferred skills</h3>
        <p>Structured skills improve deterministic candidate matching.</p>
      </section>

      <section className="recruiter-preview__facts">
        <h3>Candidate profile</h3>
        <dl>
          <div>
            <dt>Experience</dt>
            <dd>
              {job.experience.label} (minimum {job.experience.minYears} years)
            </dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{titleCase(job.level)}</dd>
          </div>
          <div>
            <dt>Education</dt>
            <dd>{job.education}</dd>
          </div>
          {job.age ? (
            <div>
              <dt>Age range</dt>
              <dd>{job.age}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {job.description.benefits.length ? (
        <section>
          <h3>Benefits</h3>
          <div className="recruiter-preview-benefits">
            {job.description.benefits.map((benefit) => {
              const option = benefitOptions.find(
                (item) => item.icon === benefit.icon,
              );
              return (
                <div key={`${benefit.icon}-${benefit.label}`}>
                  <span className="recruiter-benefit-icon" aria-hidden="true">
                    {option?.glyph ?? "+"}
                  </span>
                  <span>{benefit.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="recruiter-preview__facts">
        <h3>Working & hiring details</h3>
        <dl>
          {job.description.generalInfo.reportsTo ? (
            <div>
              <dt>Reports to</dt>
              <dd>{job.description.generalInfo.reportsTo}</dd>
            </div>
          ) : null}
          {job.description.generalInfo.workingHours ? (
            <div>
              <dt>Working hours</dt>
              <dd>{job.description.generalInfo.workingHours}</dd>
            </div>
          ) : null}
          {job.description.generalInfo.workAddress ? (
            <div>
              <dt>Work address</dt>
              <dd>{job.description.generalInfo.workAddress}</dd>
            </div>
          ) : null}
          <div>
            <dt>Saturday work</dt>
            <dd>{job.workOnSaturday ? "Required" : "Not required"}</dd>
          </div>
          <div>
            <dt>Remote scope</dt>
            <dd>
              {job.location.isNationwideRemote
                ? "Nationwide"
                : "Location-based"}
            </dd>
          </div>
          <div>
            <dt>Open positions</dt>
            <dd>{job.numberOfHires}</dd>
          </div>
          {job.applyDeadline ? (
            <div>
              <dt>Apply by</dt>
              <dd>
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                }).format(new Date(job.applyDeadline))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </aside>
  );
}
