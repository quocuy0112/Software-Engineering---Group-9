"use client";

import Link from "next/link";
import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";
import { formatSalary } from "@/shared/utils/jobs/job-display";

import companyCatalog from "../../../../../data/jobs/companies.json";
import { CompanyAvatar } from "./company-avatar";
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
  const companyPageHref = company.websiteUrl ?? "#company";

  return (
    <details
      id="company"
      className="job-sidebar-card job-company-card job-sidebar-card--redesign job-company-accordion"
      aria-labelledby="company-card-heading"
    >
      <summary className="job-company-accordion-summary">
        <span className="job-sidebar-company-heading">
          <SidebarCompanyLogo company={company} large />
          <span className="job-company-accordion-copy">
            <span className="panel-kicker">THE COMPANY</span>
            <span
              id="company-card-heading"
              className="job-company-accordion-title"
              role="heading"
              aria-level={2}
            >
              Company info
            </span>
            <span className="job-company-accordion-name">
              {company.displayName}
            </span>
            {job.isVerified ? (
              <span className="job-verified-inline">
                <span aria-hidden="true">✓</span> Verified SmartHire employer
              </span>
            ) : null}
          </span>
        </span>
        <span className="job-accordion-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>

      <div className="job-company-accordion-content">
        {rating ? (
          <span className="job-company-rating">
            <span aria-hidden="true">★</span>
            <span>{rating.score.toFixed(1)} / 5</span>
            {rating.reviewCount !== undefined ? (
              <small>· {rating.reviewCount} reviews</small>
            ) : null}
          </span>
        ) : null}

        <p className="job-sidebar-company-copy">
          {displayValue(company.publicDescription)}
        </p>

        <dl className="job-sidebar-company-facts">
          <div>
            <dt>
              <span className="job-sidebar-fact-icon" aria-hidden="true">
                S
              </span>
              Scale
            </dt>
            <dd>{displayValue(company.size)}</dd>
          </div>
          <div>
            <dt>
              <span className="job-sidebar-fact-icon" aria-hidden="true">
                I
              </span>
              Industry
            </dt>
            <dd>{displayValue(company.industry)}</dd>
          </div>
          <div>
            <dt>
              <span className="job-sidebar-fact-icon" aria-hidden="true">
                A
              </span>
              Address
            </dt>
            <dd>{displayValue(company.address ?? company.publicLocation)}</dd>
          </div>
        </dl>

        <a
          className="job-company-profile-button"
          href={companyPageHref}
          target={company.websiteUrl ? "_blank" : undefined}
          rel={company.websiteUrl ? "noreferrer" : undefined}
        >
          View company page <span aria-hidden="true">→</span>
        </a>
      </div>
    </details>
  );
}
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        "job-general-info-row" +
        (label === "Experience" ? " job-general-info-row--legacy" : "")
      }
    >
      <span className="job-general-info-icon" aria-hidden="true">
        {icon}
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
        eyebrow="AT A GLANCE"
        title="General information"
        mark="▦"
        headingId="general-information-heading"
      />
      <dl className="job-general-info-list">
        <InfoRow
          icon="↗"
          label="Level"
          value={valueLabel[job.experienceLevel] ?? "Not listed"}
        />
        <InfoRow
          icon="◷"
          label="Experience"
          value={
            job.experienceMinYears !== undefined
              ? `${job.experienceMinYears}+ years`
              : "Not listed"
          }
        />
        <InfoRow
          icon="◇"
          label="Education"
          value={job.education?.trim() || "Not listed"}
        />
        <InfoRow
          icon="◉"
          label="Number of hires"
          value={
            job.numberOfHires === undefined || job.numberOfHires === null
              ? "Not listed"
              : `${job.numberOfHires} position${job.numberOfHires === 1 ? "" : "s"}`
          }
        />
        <InfoRow
          icon="▣"
          label="Work arrangement"
          value={valueLabel[job.workArrangement] ?? "Not listed"}
        />
        <InfoRow
          icon="TY"
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
    <Link className="job-sidebar-similar-job" href={"/jobs/" + job.slug}>
      <SidebarCompanyLogo company={company} />
      <span className="job-sidebar-similar-copy">
        <strong>{job.title}</strong>
        <small>{company.displayName}</small>
        <small
          className={
            job.salary?.isNegotiable ? "job-salary--negotiable" : undefined
          }
        >
          {formatSalary(job.salary)} · {job.location}
        </small>
      </span>
    </Link>
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
        eyebrow="EXPLORE MORE"
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
          <p className="panel-kicker">SAFETY CHECK</p>
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
