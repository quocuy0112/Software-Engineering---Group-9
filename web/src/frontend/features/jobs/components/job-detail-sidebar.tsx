"use client";

import Link from "next/link";
import type { JobCard, JobDetail } from "@/shared/contracts/jobs/discovery";

import { useState } from "react";
import companyCatalog from "../../../../../data/jobs/companies.json";

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
  photoUrl?: string | null;
  photo?: string | null;
  coverImage?: string | null;
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
  const fixtureWithMedia = fixture as
    | (CompanyFixture & {
        photoUrl?: string | null;
        photo?: string | null;
        coverImage?: string | null;
      })
    | undefined;

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
    photoUrl:
      nonEmpty(company.photoUrl) ??
      nonEmpty(company.photo) ??
      nonEmpty(company.coverImage) ??
      nonEmpty(fixtureWithMedia?.photoUrl) ??
      nonEmpty(fixtureWithMedia?.photo) ??
      nonEmpty(fixtureWithMedia?.coverImage) ??
      null,
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
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = nonEmpty(data.logoUrl) ?? nonEmpty(data.logo);
  const showLogo = Boolean(logoUrl && logoUrl !== failedLogoUrl);

  return (
    <span className={"job-sidebar-company-logo" + (large ? " is-large" : "")}>
      {showLogo ? (
        <img
          src={logoUrl ?? undefined}
          alt=""
          loading={large ? "eager" : "lazy"}
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span aria-hidden="true">
          {data.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
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
  const logoUrl = data.logoUrl ?? data.logo ?? null;

  return (
    <span className={"job-company-logo" + (large ? " is-large" : "")}>
      {logoUrl ? (
        <img src={logoUrl} alt="" loading={large ? "eager" : "lazy"} />
      ) : (
        <span aria-hidden="true">
          {data.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
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
    <section
      id="company"
      className="job-sidebar-card job-company-card job-sidebar-card--redesign"
      aria-labelledby="company-card-heading"
      data-job-sidebar-company="true"
    >
      <div className="job-sidebar-card-heading job-sidebar-company-heading">
        <SidebarCompanyLogo company={company} large />
        <div>
          <p className="panel-kicker">THE COMPANY</p>
          <h2 id="company-card-heading">{company.displayName}</h2>
          {job.isVerified ? (
            <span className="job-verified-inline">
              <span aria-hidden="true">✓</span> Verified SmartHire employer
            </span>
          ) : null}
          {rating ? (
            <span className="job-company-rating">
              <span aria-hidden="true">★</span>
              <span>{rating.score.toFixed(1)} / 5</span>
              {rating.reviewCount !== undefined ? (
                <small>· {rating.reviewCount} reviews</small>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="job-sidebar-company-lockup">
        <SidebarCompanyLogo company={company} large />
        <div className="job-sidebar-company-signal">
          <p>{displayValue(company.industry)}</p>
        </div>
      </div>

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
    </section>
  );
}

export function CompanyPhotoCard({ job }: { job: JobDetail }) {
  const company = resolveSidebarCompany(job.company);
  const fallback = "/company-cover-placeholder.svg";
  const [photoSrc, setPhotoSrc] = useState(company.photoUrl ?? fallback);
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <section
      className="job-sidebar-card job-sidebar-card--redesign job-company-photo-card"
      aria-label={company.displayName + " workplace"}
    >
      <img
        src={photoSrc}
        alt={company.displayName + " workplace"}
        loading="lazy"
        onError={() => {
          if (!photoFailed) {
            setPhotoFailed(true);
            setPhotoSrc(fallback);
          }
        }}
      />
    </section>
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
          value={job.education ?? "Not listed"}
        />
        <InfoRow
          icon="◉"
          label="Number of hires"
          value={
            job.headcount === undefined
              ? "Not listed"
              : `${job.headcount} opening${job.headcount === 1 ? "" : "s"}`
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

function RecommendationRow({ job }: { job: JobCard }) {
  const company = resolveSidebarCompany(job.company);

  return (
    <Link
      className="job-recommendation job-recommendation--redesign"
      href={`/jobs/${job.slug}`}
    >
      <SidebarCompanyLogo company={company} />
      <span className="job-recommendation-title">{job.title}</span>
      <strong>
        {job.matchScore !== undefined ? `${job.matchScore}%` : "—"}
      </strong>
      <span className="job-recommendation-company">{company.displayName}</span>
    </Link>
  );
}

export function RecommendedJobsCard({ job }: { job: JobDetail }) {
  const recommendations = [
    ...(job.recommendedJobs?.length
      ? job.recommendedJobs
      : (job.relatedJobs ?? [])),
  ]
    .sort((left, right) => (right.matchScore ?? -1) - (left.matchScore ?? -1))
    .slice(0, 3);

  return (
    <section
      className="job-sidebar-card job-sidebar-card--redesign"
      aria-labelledby="recommended-jobs-heading"
    >
      <SidebarCardHeading
        eyebrow="PROFILE SIGNAL"
        title="Recommended matching jobs"
        mark="✦"
        headingId="recommended-jobs-heading"
      />
      <p className="job-sidebar-copy">
        Ranked by the same deterministic signals as related jobs, then compared
        with your profile when available.
      </p>
      {recommendations.length ? (
        <div className="job-recommendation-list">
          {recommendations.map((item) => (
            <RecommendationRow key={item.id} job={item} />
          ))}
        </div>
      ) : (
        <p className="job-section-muted">
          Matching jobs will appear here as more profile signals become
          available.
        </p>
      )}
    </section>
  );
}

function SidebarFooter() {
  return (
    <div className="job-sidebar-footer">
      <aside className="job-safety-banner">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Stay scam-aware</strong>
          <p>Never pay to apply or share passwords with a recruiter.</p>
        </div>
      </aside>
      <Link className="job-tax-banner" href="/jobs?tool=salary-tax-calculator">
        <span aria-hidden="true">↗</span>
        <span>
          <strong>Salary &amp; tax calculator</strong>
          <small>Estimate take-home pay quietly</small>
        </span>
      </Link>
    </div>
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
      <CompanyPhotoCard job={job} />
      <GeneralInfoCard job={job} />
      <SidebarFooter />
    </aside>
  );
}
