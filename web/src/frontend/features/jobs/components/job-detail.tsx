"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import { ApplyFormSection } from "./apply-form-section";
import { JobDetailTabs } from "./job-detail-tabs";
import { QuickSkillChips } from "./quick-skill-chips";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { RelatedJobsCarousel } from "./related-jobs-carousel";
import { ReportJobDialog } from "./report-job-dialog";
import { SaveJobAction } from "./save-job-action";

import { WhyJoinUsSection } from "./why-join-us-section";

export { JobDetailPage, JobDetailView } from "./job-detail-redesign";

const stateLabel = {
  ACTIVE: "Active",
  CLOSED: "Closed",
  EXPIRED: "Expired",
} as const;

const valueLabel: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  ENTRY: "Entry",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

function formatSalary(job: JobDetail) {
  if (!job.salary) return "Salary not disclosed";
  const formatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: job.salary.currency,
    maximumFractionDigits: 0,
  });
  return (
    formatter.format(job.salary.minimum) +
    " - " +
    formatter.format(job.salary.maximum) +
    " / " +
    job.salary.period.toLowerCase()
  );
}

const jobDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

type CompanyWithRating = JobDetail["company"] & {
  rating?: { score: number; reviewCount: number };
};

function CompanyLogo({
  company,
  large = false,
}: {
  company: JobDetail["company"];
  large?: boolean;
}) {
  const companyWithRating = company as CompanyWithRating;
  return (
    <span className={"job-company-logo" + (large ? " is-large" : "")}>
      {companyWithRating.logoUrl ? (
        <img
          src={companyWithRating.logoUrl}
          alt=""
          loading={large ? "eager" : "lazy"}
        />
      ) : (
        <span aria-hidden="true">
          {companyWithRating.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function RecommendationCard({
  job,
}: {
  job: NonNullable<JobDetail["relatedJobs"]>[number];
}) {
  return (
    <Link
      className="job-recommendation job-recommendation--redesign"
      href={"/jobs/" + job.slug}
    >
      <span className="job-recommendation-topline">
        <CompanyLogo company={job.company} />
        {job.matchScore !== undefined ? (
          <strong>{job.matchScore}% match</strong>
        ) : null}
      </span>
      <span className="job-recommendation-title">{job.title}</span>
      <span className="job-recommendation-company">
        {job.company.displayName}
      </span>
      <span className="job-recommendation-location">{job.location}</span>
    </Link>
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
    <div className="job-general-info-row">
      <span className="job-general-info-icon" aria-hidden="true">
        {icon}
      </span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DetailActionButtons({
  job,
  applied,
  applyOpen,
  onApply,
}: {
  job: JobDetail;
  applied: boolean;
  applyOpen: boolean;
  onApply: () => void;
}) {
  const returnTo = encodeURIComponent("/jobs/" + job.slug);

  return (
    <div className="job-detail-primary-actions">
      {job.state === "ACTIVE" && job.actions.canApply ? (
        applied ? (
          <span className="job-applied-state">✓ Applied</span>
        ) : job.actions.authenticated ? (
          <button
            className="sh-button job-detail-apply-button"
            type="button"
            aria-expanded={applyOpen}
            aria-controls="apply"
            onClick={onApply}
          >
            {applyOpen ? "Hide application form" : "Apply now"}
          </button>
        ) : (
          <Link
            className="sh-button job-detail-apply-button"
            href={"/login?returnTo=" + returnTo}
          >
            Sign in to apply
          </Link>
        )
      ) : (
        <span className="job-closed-state">Applications closed</span>
      )}

      {job.actions.authenticated && job.actions.canSave ? (
        <SaveJobAction
          jobId={job.id}
          initialSaved={job.actions.saved}
          initialApplied={job.actions.applied}
          variant="button"
        />
      ) : (
        <Link
          className="job-secondary-button"
          href={"/login?returnTo=" + returnTo}
        >
          <span aria-hidden="true">♡</span> Save
        </Link>
      )}
    </div>
  );
}
export function LegacyJobDetailView({ job }: { job: JobDetail }) {
  const shared = useOptionalJobInteraction();
  const [applyOpen, setApplyOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return (
      window.location.hash.toLowerCase() === "#apply" ||
      params.get("openApply") === "true"
    );
  });
  const [submittedHere, setSubmittedHere] = useState(false);
  const applied =
    job.actions.applied ||
    submittedHere ||
    Boolean(shared?.records[job.id]?.applied);
  const recommendations = (job.recommendedJobs ?? job.relatedJobs ?? []).slice(
    0,
    3,
  );
  const company = job.company as CompanyWithRating;

  useEffect(() => {
    shared?.registerJob(job.id, {
      saved: job.actions.saved,
      applied: job.actions.applied,
    });
  }, [job.actions.applied, job.actions.saved, job.id, shared]);

  useEffect(() => {
    function syncApplyState() {
      const params = new URLSearchParams(window.location.search);
      const shouldOpen =
        window.location.hash.toLowerCase() === "#apply" ||
        params.get("openApply") === "true";
      setApplyOpen(shouldOpen);
      if (shouldOpen) {
        window.setTimeout(() => {
          document
            .getElementById("apply")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
    }

    syncApplyState();
    window.addEventListener("hashchange", syncApplyState);
    return () => window.removeEventListener("hashchange", syncApplyState);
  }, []);

  function setApplyVisibility(next: boolean) {
    setApplyOpen(next);
    const url = new URL(window.location.href);
    if (next) {
      url.hash = "apply";
      url.searchParams.delete("openApply");
    } else {
      url.hash = "";
      url.searchParams.delete("openApply");
    }
    window.history.replaceState(null, "", url);
    if (next) {
      window.setTimeout(() => {
        document
          .getElementById("apply")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  return (
    <article className="jobs-detail-page job-redesign-detail">
      <Link className="job-detail-back" href="/jobs">
        <span aria-hidden="true">←</span> Back to jobs
      </Link>

      <div className="job-detail-layout job-detail-layout--redesign">
        <main className="job-detail-main job-detail-main--redesign">
          <header className="job-detail-hero job-detail-hero--redesign">
            <div className="job-detail-hero-topline">
              <div className="job-detail-company-lockup">
                <CompanyLogo company={job.company} large />
                <div>
                  <p className="job-company-name">{job.company.displayName}</p>
                  <span className="job-verified-inline">
                    <span aria-hidden="true">✓</span> Verified company
                  </span>
                </div>
              </div>
              <span
                className="job-state"
                aria-label={"Job status: " + stateLabel[job.state]}
              >
                {stateLabel[job.state]}
              </span>
            </div>

            <p className="job-detail-eyebrow">A ROLE WORTH YOUR NEXT MOVE</p>
            <h1>{job.title}</h1>
            <p className="job-detail-summary">{job.summary}</p>

            <div className="job-detail-key-meta" aria-label="Job overview">
              <span>
                <span aria-hidden="true">◫</span> {formatSalary(job)}
              </span>
              <span>
                <span aria-hidden="true">⌖</span> {job.location}
              </span>
              <span>
                <span aria-hidden="true">◷</span>{" "}
                {valueLabel[job.experienceLevel] ?? job.experienceLevel}
              </span>
              <span>
                <span aria-hidden="true">⌛</span>{" "}
                {job.applicationDeadline
                  ? "Apply by " +
                    jobDate.format(new Date(job.applicationDeadline))
                  : "Open until filled"}
              </span>
            </div>

            <div className="job-detail-action-row" aria-label="Job actions">
              <DetailActionButtons
                job={job}
                applied={applied}
                applyOpen={applyOpen}
                onApply={() => setApplyVisibility(!applyOpen)}
              />
              {job.actions.authenticated && job.actions.canReport ? (
                <ReportJobDialog jobId={job.id} />
              ) : null}
            </div>
          </header>

          <div
            className="job-detail-sticky-actions"
            aria-label="Sticky job actions"
          >
            <div className="job-detail-sticky-copy">
              <span className="panel-kicker">QUICK APPLY</span>
              <strong>{job.title}</strong>
            </div>
            <DetailActionButtons
              job={job}
              applied={applied}
              applyOpen={applyOpen}
              onApply={() => setApplyVisibility(!applyOpen)}
            />
          </div>

          <QuickSkillChips job={job} />
          <WhyJoinUsSection job={job} />
          <JobDetailTabs job={job} />

          <ApplyFormSection
            jobId={job.id}
            jobTitle={job.title}
            open={applyOpen}
            applied={applied}
            onOpenChange={setApplyVisibility}
            onSubmitted={() => setSubmittedHere(true)}
          />
          <RelatedJobsCarousel jobs={job.relatedJobs ?? []} />
        </main>

        <aside
          className="job-detail-sidebar job-detail-sidebar--redesign"
          aria-label="Job context"
        >
          <section className="job-sidebar-card job-company-card job-sidebar-card--redesign">
            <div className="job-sidebar-card-heading">
              <div>
                <p className="panel-kicker">THE COMPANY</p>
                <h2>{job.company.displayName}</h2>
              </div>
              <span
                className="job-sidebar-card-check"
                aria-label="Verified company"
              >
                ✓
              </span>
            </div>

            <div className="job-sidebar-company-lockup">
              <CompanyLogo company={job.company} large />
              <div>
                <p>{job.company.industry ?? "Verified SmartHire employer"}</p>
                {company.rating ? (
                  <span className="job-company-rating">
                    <span aria-hidden="true">★</span>{" "}
                    {company.rating.score.toFixed(1)}
                    <small> / 5 · {company.rating.reviewCount} reviews</small>
                  </span>
                ) : null}
              </div>
            </div>

            <p className="job-sidebar-company-copy">
              {job.company.publicDescription ??
                "Company profile details are available from the hiring team."}
            </p>
            <dl className="job-sidebar-company-facts">
              <div>
                <dt>Scale</dt>
                <dd>{job.company.size ?? "Not listed"}</dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>{job.company.industry ?? "Not listed"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {job.company.address ??
                    job.company.publicLocation ??
                    job.location}
                </dd>
              </div>
            </dl>
            <a className="job-company-profile-button" href="?tab=company">
              View company profile <span aria-hidden="true">→</span>
            </a>
          </section>

          <section className="job-sidebar-card job-sidebar-card--redesign">
            <div className="job-sidebar-card-heading">
              <div>
                <p className="panel-kicker">AT A GLANCE</p>
                <h2>General information</h2>
              </div>
              <span className="job-sidebar-card-mark" aria-hidden="true">
                ⌁
              </span>
            </div>
            <dl className="job-general-info-list">
              <InfoRow
                icon="↗"
                label="Job level"
                value={valueLabel[job.experienceLevel] ?? job.experienceLevel}
              />
              <InfoRow
                icon="◷"
                label="Experience"
                value={
                  job.experienceMinYears !== undefined
                    ? job.experienceMinYears + "+ years"
                    : (valueLabel[job.experienceLevel] ?? "Relevant experience")
                }
              />
              <InfoRow
                icon="◇"
                label="Education"
                value={job.education ?? "Relevant experience or degree"}
              />
              <InfoRow
                icon="◎"
                label="Hiring quota"
                value={
                  (job.headcount ?? 1) +
                  " opening" +
                  (job.headcount === 1 ? "" : "s")
                }
              />
              <InfoRow
                icon="▣"
                label="Employment type"
                value={valueLabel[job.employmentType] ?? job.employmentType}
              />
              <InfoRow
                icon="⌂"
                label="Work arrangement"
                value={valueLabel[job.workArrangement] ?? job.workArrangement}
              />
            </dl>
          </section>

          {recommendations.length ? (
            <section className="job-sidebar-card job-sidebar-card--redesign">
              <div className="job-sidebar-card-heading">
                <div>
                  <p className="panel-kicker">PROFILE SIGNAL</p>
                  <h2>Recommended matching jobs</h2>
                </div>
                <span className="job-sidebar-card-mark" aria-hidden="true">
                  ✦
                </span>
              </div>
              <p className="job-sidebar-copy">
                Deterministic matches based on category, skills, location,
                salary, and experience.
              </p>
              <div className="job-recommendation-list">
                {recommendations.map((item) => (
                  <RecommendationCard key={item.id} job={item} />
                ))}
              </div>
            </section>
          ) : null}

          <div className="job-sidebar-footer">
            <aside className="job-safety-banner">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Stay scam-aware</strong>
                <p>Never pay to apply or share passwords with a recruiter.</p>
              </div>
            </aside>
            <Link
              className="job-tax-banner"
              href="/jobs?tool=salary-tax-calculator"
            >
              <span aria-hidden="true">↗</span>
              <span>
                <strong>Salary &amp; tax calculator</strong>
                <small>Estimate take-home pay quietly</small>
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
