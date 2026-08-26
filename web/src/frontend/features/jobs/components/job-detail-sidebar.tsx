"use client";

import Link from "next/link";
import { CollapsibleCard } from "@/frontend/components/ui/collapsible-card";
import { RatingRow } from "@/frontend/components/ui/rating-row";
import { RelatedJobRow } from "@/frontend/components/ui/related-job-row";
import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";
import companyCatalog from "../../../../../data/companies/companies.json";
import { CompanyAvatar } from "./company-avatar";
import { JobMetaIcon, type JobMetaIconName } from "./job-meta-icon";
import { ReportJobDialog } from "./report-job-dialog";

const valueLabel: Record<string, string> = {
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

export type CompanyWithMeta = JobDetail["company"] & {
  logo?: string | null;
  rating?: { score: number; reviewCount?: number };
};

function companyWithMeta(company: JobDetail["company"]): CompanyWithMeta {
  return company as CompanyWithMeta;
}

type CompanyFixture = (typeof companyCatalog)[number];

function nonEmpty(value: string | null | undefined) {
  return value?.trim() ? value : null;
}

function companyKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function companyFixtureFor(
  company: CompanyWithMeta,
): CompanyFixture | undefined {
  const keys = new Set(
    [company.slug, company.displayName].map(companyKey).filter(Boolean),
  );
  return companyCatalog.find(
    (entry) =>
      keys.has(companyKey(entry.slug)) || keys.has(companyKey(entry.name)),
  );
}

function resolveSidebarCompany(company: CompanyWithMeta): CompanyWithMeta {
  const fixture = companyFixtureFor(company);

  return {
    ...company,
    displayName: nonEmpty(company.displayName) ?? fixture?.name ?? "Company",
    logoUrl:
      nonEmpty(company.logoUrl) ??
      nonEmpty(company.logo) ??
      nonEmpty(fixture?.logo) ??
      null,
    websiteUrl:
      nonEmpty(company.websiteUrl) ?? nonEmpty(fixture?.website) ?? null,
    publicDescription:
      nonEmpty(company.publicDescription) ??
      nonEmpty(fixture?.description) ??
      null,
    publicLocation:
      nonEmpty(company.publicLocation) ?? nonEmpty(fixture?.address) ?? null,
    size: nonEmpty(company.size) ?? nonEmpty(fixture?.size) ?? undefined,
    industry:
      nonEmpty(company.industry) ?? nonEmpty(fixture?.industry) ?? undefined,
    address:
      nonEmpty(company.address) ?? nonEmpty(fixture?.address) ?? undefined,
    rating: company.rating ?? fixture?.rating,
  };
}

function SidebarCompanyLogo({
  company,
  large = false,
}: {
  company: CompanyWithMeta;
  large?: boolean;
}) {
  const data = resolveSidebarCompany(company);
  return (
    <CompanyAvatar
      name={data.displayName}
      imageUrl={data.logoUrl ?? data.logo}
      size={large ? "lg" : "md"}
      className={"job-sidebar-company-logo" + (large ? " is-large" : "")}
      loading={large ? "eager" : "lazy"}
    />
  );
}

export function CompanyLogo({
  company,
  large = false,
}: {
  company: JobDetail["company"] | JobCard["company"];
  large?: boolean;
}) {
  const data = companyWithMeta(company);
  return (
    <CompanyAvatar
      name={data.displayName}
      imageUrl={data.logoUrl ?? data.logo}
      size={large ? "lg" : "md"}
      className={"job-company-logo" + (large ? " is-large" : "")}
      loading={large ? "eager" : "lazy"}
    />
  );
}

function displayValue(value: string | null | undefined) {
  return value?.trim() ? value : "Not listed";
}

function SidebarCardHeading({
  eyebrow,
  title,
  mark,
  headingId,
}: {
  eyebrow: string;
  title: string;
  mark: string;
  headingId: string;
}) {
  return (
    <div className="job-sidebar-card-heading">
      <div>
        <p className="panel-kicker">{eyebrow}</p>
        <h2 id={headingId}>{title}</h2>
      </div>
      <span className="job-sidebar-card-mark" aria-hidden="true">
        {mark}
      </span>
    </div>
  );
}

export function CompanyCard({ job }: { job: JobDetail }) {
  const company = resolveSidebarCompany(job.company);
  const rating = company.rating;

  return (
    <CollapsibleCard
      id="company"
      className="job-sidebar-card job-company-card job-sidebar-card--redesign job-company-accordion"
      defaultExpanded
      titleId="company-card-heading"
      triggerClassName="job-company-accordion-summary"
      contentClassName="job-company-accordion-content"
      title={
        <span className="job-company-accordion-heading">
          <span className="panel-kicker">The company</span>
          <span
            className="job-company-accordion-title"
            role="heading"
            aria-level={2}
          >
            Company info
          </span>
        </span>
      }
      persistentContent={
        <div className="job-company-accordion-identity">
          <SidebarCompanyLogo company={company} large />
          <div className="job-company-accordion-copy">
            <p className="job-company-accordion-name">{company.displayName}</p>
            {job.isVerified ? (
              <span className="job-verified-inline">
                <span aria-hidden="true">✓</span> Verified SmartHire employer
              </span>
            ) : null}
          </div>
        </div>
      }
    >
      {rating ? (
        <RatingRow score={rating.score} reviewCount={rating.reviewCount} />
      ) : null}

      <p className="job-sidebar-company-copy">
        {displayValue(company.publicDescription)}
      </p>

      <dl className="job-sidebar-company-facts">
        <div>
          <dt>
            <span className="job-sidebar-fact-icon" aria-hidden="true">
              <JobMetaIcon name="company-size" />
            </span>
            Scale
          </dt>
          <dd>{displayValue(company.size)}</dd>
        </div>
        <div>
          <dt>
            <span className="job-sidebar-fact-icon" aria-hidden="true">
              <JobMetaIcon name="industry" />
            </span>
            Industry
          </dt>
          <dd>{displayValue(company.industry)}</dd>
        </div>
        <div>
          <dt>
            <span className="job-sidebar-fact-icon" aria-hidden="true">
              <JobMetaIcon name="location" />
            </span>
            Address
          </dt>
          <dd>{displayValue(company.address ?? company.publicLocation)}</dd>
        </div>
      </dl>

      {company.websiteUrl ? (
        <a
          className="sh-button sh-button--outline job-company-profile-button"
          href={company.websiteUrl}
          target="_blank"
          rel="noreferrer"
        >
          Visit company website <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </CollapsibleCard>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: JobMetaIconName;
  label: string;
  value: string;
}) {
  return (
    <div className="job-general-info-row">
      <span className="job-general-info-icon" aria-hidden="true">
        <JobMetaIcon name={icon} />
      </span>
      <dt>{label}</dt>
      <dd>{displayValue(value)}</dd>
    </div>
  );
}

export function GeneralInfoCard({ job }: { job: JobDetail }) {
  return (
    <section
      className="job-sidebar-card job-sidebar-card--redesign"
      aria-labelledby="general-information-heading"
    >
      <SidebarCardHeading
        eyebrow="At a glance"
        title="General information"
        mark="◆"
        headingId="general-information-heading"
      />
      <dl className="job-general-info-list">
        <InfoRow
          icon="level"
          label="Level"
          value={valueLabel[job.experienceLevel] ?? "Not listed"}
        />
        <InfoRow
          icon="education"
          label="Education"
          value={job.education?.trim() || "Not listed"}
        />
        <InfoRow
          icon="hires"
          label="Number of hires"
          value={
            job.numberOfHires === undefined || job.numberOfHires === null
              ? "Not listed"
              : `${job.numberOfHires} position${job.numberOfHires === 1 ? "" : "s"}`
          }
        />
        <InfoRow
          icon="arrangement"
          label="Work arrangement"
          value={valueLabel[job.workArrangement] ?? "Not listed"}
        />
        <InfoRow
          icon="employment"
          label="Employment type"
          value={valueLabel[job.employmentType] ?? "Not listed"}
        />
      </dl>
    </section>
  );
}

function SimilarJobRow({ job }: { job: JobCard }) {
  const company = resolveSidebarCompany(job.company);
  return (
    <RelatedJobRow
      compact
      href={`/jobs/${job.slug}`}
      avatarLabel={company.displayName.slice(0, 2).toUpperCase()}
      avatar={<SidebarCompanyLogo company={company} />}
      title={job.title}
      company={company.displayName}
      location={job.location}
      salaryRange={formatSalary(job.salary)}
    />
  );
}

export function SimilarJobsCard({ job }: { job: JobDetail }) {
  const relatedJobIds = new Set((job.relatedJobs ?? []).map((item) => item.id));
  const similarJobs = (job.recommendedJobs ?? [])
    .filter((item) => !relatedJobIds.has(item.id))
    .slice(0, 5);

  return (
    <section
      className="job-sidebar-card job-sidebar-card--redesign job-similar-jobs-card"
      aria-labelledby="similar-jobs-heading"
    >
      <SidebarCardHeading
        eyebrow="Explore more"
        title="Similar jobs"
        mark="↗"
        headingId="similar-jobs-heading"
      />
      {similarJobs.length ? (
        <div className="job-sidebar-similar-list">
          {similarJobs.map((item) => (
            <SimilarJobRow key={item.id} job={item} />
          ))}
        </div>
      ) : (
        <p className="job-section-muted">
          Similar jobs will appear here as more roles become available.
        </p>
      )}
      <Link className="job-similar-more-link" href="/jobs">
        See more <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export function ReportJobWidget({ job }: { job: JobDetail }) {
  return (
    <section
      className="job-sidebar-card job-sidebar-card--redesign job-report-widget"
      aria-labelledby="report-this-job-heading"
    >
      <div className="job-report-widget-heading">
        <span className="job-report-widget-icon" aria-hidden="true">
          !
        </span>
        <div>
          <p className="panel-kicker">Safety check</p>
          <h2 id="report-this-job-heading">Report this job</h2>
        </div>
      </div>
      <p>
        This job seems off or suspicious? Let our team know so we can review it.
      </p>
      <ReportJobDialog jobId={job.id} className="job-report-widget-button" />
    </section>
  );
}

export function JobDetailSidebar({ job }: { job: JobDetail }) {
  return (
    <aside
      className="job-detail-sidebar job-detail-sidebar--redesign job-detail-sidebar--board"
      aria-label="Job context"
      data-job-detail-sidebar="true"
    >
      <CompanyCard job={job} />
      <GeneralInfoCard job={job} />
      <SimilarJobsCard job={job} />
      <ReportJobWidget job={job} />
    </aside>
  );
}
