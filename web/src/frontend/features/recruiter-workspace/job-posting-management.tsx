"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import {
  WorkspaceNavIcon,
  type WorkspaceNavIconName,
} from "@/frontend/features/dashboard/components/workspace-navigation-icons";
import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import { JobPostingEditor } from "./job-posting-editor";
import { CandidateRankingList } from "@/frontend/features/recruiter-applications/candidate-ranking-list";
import {
  createEmptyJobPosting,
  recruiterJobStatusMeta,
  type RecruiterCompanyView,
  type RecruiterJob,
  type RecruiterJobManagementData,
  type RecruiterJobStatus,
} from "@/shared/contracts/recruiter-job-posting";
import type { JobCatalogItem } from "@/shared/contracts/jobs/catalog";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";

const tabs: Array<{
  value: "active" | "draft" | "pending_approval" | "closed";
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Drafts" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "closed", label: "Closed" },
];

const emptyData: RecruiterJobManagementData = {
  jobs: [],
  companies: [],
  companyId: null,
};

const JOB_POSTINGS_REFRESH_INTERVAL_MS = 5_000;

async function fetchRecruiterJobManagementData() {
  const response = await fetch("/api/recruiter/job-postings", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load job postings.");
  return response.json() as Promise<RecruiterJobManagementData>;
}

function Icon({
  name,
}: {
  name:
    | "briefcase"
    | "users"
    | "clock"
    | "check"
    | "warning"
    | "calendar"
    | "search"
    | "plus"
    | "arrow"
    | "edit"
    | "close"
    | "check";
}) {
  const paths = {
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 11h18M9 11v1.5h6V11" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2" />
        <path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M14.5 15c2.8-.4 4.8 1.2 5.5 4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 9h16" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.3" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    edit: (
      <>
        <path d="m5 16-.8 4 4-.8L19 8.4a2.8 2.8 0 0 0-4-4L5 16Z" />
        <path d="m13.5 6.5 4 4" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    warning: (
      <>
        <path d="M12 2 2 19.5h20L12 2z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
  } as const;
  return (
    <svg className="recruiter-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatRelative(value: string) {
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(delta / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function locationLabel(job: RecruiterJob) {
  return (
    [job.location.city, job.location.district].filter(Boolean).join(", ") ||
    "Location not set"
  );
}

function arrangementLabel(job: RecruiterJob) {
  return job.workArrangement
    .replace(/_/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function isClosingSoon(job: RecruiterJob) {
  if (job.status !== "active" || !job.applyDeadline) return false;
  const remaining = new Date(job.applyDeadline).getTime() - Date.now();
  return remaining >= 0 && remaining <= 7 * 86_400_000;
}

function formatReasonCode(code: string): string {
  const reasonLabels: Record<string, string> = {
    INCOMPLETE_OR_UNCLEAR: "Incomplete or unclear information",
    MISLEADING_CONTENT: "Misleading content",
    INAPPROPRIATE_LANGUAGE: "Inappropriate language",
    DUPLICATE_POSTING: "Duplicate posting",
    INVALID_REQUIREMENTS: "Invalid requirements",
    INSUFFICIENT_COMPENSATION: "Insufficient compensation details",
    VERIFICATION_MISMATCH: "Verification mismatch",
    PROHIBITED_CONTENT: "Prohibited content",
    OTHER: "Other reason",
  };
  return reasonLabels[code] || code.replace(/_/g, " ");
}

function statusForTab(job: RecruiterJob, tab: (typeof tabs)[number]["value"]) {
  return tab === "draft"
    ? job.status === "draft" || job.status === "rejected"
    : job.status === tab;
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: "briefcase" | "users" | "clock" | "calendar";
  tone: string;
}) {
  return (
    <article className={`recruiter-stat-card recruiter-stat-card--${tone}`}>
      <span className="recruiter-feature-icon">
        <Icon name={icon} />
      </span>
      <div>
        <strong>{value.toLocaleString("en-US")}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: RecruiterJobStatus }) {
  const meta = recruiterJobStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function JobPostingCard({
  job,
  onEdit,
  onApplicants,
  onClose,
  onExtend,
}: {
  job: RecruiterJob;
  onEdit: () => void;
  onApplicants: () => void;
  onClose: () => void;
  onExtend: () => void;
}) {
  const title = job.title || "Untitled job posting";
  return (
    <article
      className="recruiter-job-card"
      aria-labelledby={`recruiter-job-${job.id}`}
    >
      <div className="recruiter-job-card__header">
        <div className="recruiter-job-card__company">
          <CompanyAvatar
            name={job.company.name}
            imageUrl={job.company.logo}
            size="sm"
          />
          <div>
            <strong>{job.company.name}</strong>
            <span>Updated {formatRelative(job.updatedAt)}</span>
          </div>
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="recruiter-job-card__body">
        <h2 id={`recruiter-job-${job.id}`}>{title}</h2>
        <p className="recruiter-job-card__meta">
          {job.description.generalInfo.department ||
            job.categoryFamily ||
            "No department"}
          <span aria-hidden="true">|</span>
          {locationLabel(job)}
          <span aria-hidden="true">|</span>
          {arrangementLabel(job)}
        </p>
        {job.review ? (
          <>
            <p
              className={`recruiter-review-state recruiter-review-state--${job.review.state.toLowerCase()}`}
              role="status"
              aria-live="polite"
            >
              <Icon
                name={
                  job.review.state === "APPROVED"
                    ? "check"
                    : job.review.state === "REJECTED"
                      ? "warning"
                      : "clock"
                }
                aria-hidden="true"
              />
              <strong>
                Review version {job.review.sequence}:{" "}
                {job.review.state.replace("_", " ")}
              </strong>
              {job.review.readOnly
                ? " — This submitted version is locked while an Administrator reviews it."
                : null}
            </p>
            {job.review.state === "REJECTED" && job.review.reasonCode ? (
              <div
                className="recruiter-review-feedback"
                role="region"
                aria-label="Rejection feedback"
              >
                <p className="recruiter-review-feedback__reason">
                  <strong>{formatReasonCode(job.review.reasonCode)}</strong>
                </p>
                {job.review.publicExplanation ? (
                  <p className="recruiter-review-feedback__explanation">
                    {job.review.publicExplanation}
                  </p>
                ) : null}
                <p className="recruiter-review-feedback__guidance">
                  Revise the posting and submit again to request a new review.
                </p>
              </div>
            ) : null}
            {job.review.state === "APPROVED" ? (
              <p className="recruiter-review-approved-note" role="status">
                This job post has been approved and is visible to candidates.
              </p>
            ) : null}
          </>
        ) : null}
        {job.correctionRequest ? (
          <div
            className="recruiter-review-feedback"
            role="region"
            aria-label="Administrator correction request"
          >
            <p className="recruiter-review-feedback__reason">
              <strong>Administrator requested changes</strong>
            </p>
            <p className="recruiter-review-feedback__explanation">
              {job.correctionRequest.publicExplanation}
            </p>
            <p className="recruiter-review-feedback__guidance">
              Your approved version remains live while you revise and submit a
              new version for review.
            </p>
          </div>
        ) : null}
        <div className="recruiter-job-card__chips" aria-label="Skills">
          {job.skillTags.slice(0, 6).map((skill) => (
            <span className="recruiter-skill-chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
      </div>
      <footer className="recruiter-job-card__footer">
        <button
          type="button"
          className="recruiter-applicant-link"
          aria-label={`${job.stats.applicantCount} Applicants for ${title}`}
          onClick={onApplicants}
        >
          <Icon name="users" />
          <strong>{job.stats.applicantCount.toLocaleString("en-US")}</strong>
          <span>Applicants</span>
          <Icon name="arrow" />
        </button>
        <Link
          href={recruiterRoutes.pipelineForJob(job.id)}
          className="recruiter-applicant-link recruiter-applicant-link--pipeline"
          aria-label={`View pipeline for ${title}`}
        >
          <WorkspaceNavIcon name="pipeline" />
          <span>View pipeline</span>
          <Icon name="arrow" />
        </Link>
        <div className="recruiter-job-card__actions">
          <button
            type="button"
            className="recruiter-outline-button"
            onClick={onEdit}
            aria-label={
              job.status === "rejected"
                ? `Revise rejected job posting: ${title}`
                : job.status === "pending_approval"
                  ? `View job posting under review: ${title}`
                  : `Edit job posting: ${title}`
            }
          >
            <Icon name="edit" />
            {job.status === "rejected"
              ? "Revise posting"
              : job.status === "pending_approval"
                ? "View posting"
                : "Edit posting"}
          </button>
          {job.status === "active" ? (
            <button
              type="button"
              className="recruiter-primary-button"
              onClick={isClosingSoon(job) ? onExtend : onClose}
            >
              {isClosingSoon(job) ? "Extend deadline" : "Close early"}
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

function JobListSkeleton() {
  return (
    <div
      className="recruiter-job-list recruiter-job-list--skeleton"
      role="status"
      aria-label="Loading job postings"
    >
      {[1, 2, 3].map((item) => (
        <div className="recruiter-skeleton-card" key={item}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasAnyJobs,
  tab,
  onCreate,
}: {
  hasAnyJobs: boolean;
  tab: (typeof tabs)[number]["value"];
  onCreate: () => void;
}) {
  const copy = hasAnyJobs
    ? {
        active: [
          "No active job postings",
          "Approved roles will appear here once they are ready for candidates.",
        ],
        draft: [
          "No drafts yet",
          "Start with a structured posting and save it when you are ready to continue.",
        ],
        pending_approval: [
          "Nothing waiting for review",
          "Submitted postings stay here until an admin approves or requests changes.",
        ],
        closed: [
          "No closed postings",
          "Roles closed manually or after their application window remain here for reference.",
        ],
      }[tab]
    : [
        "Create your first job posting",
        "Turn your next hiring need into a structured, candidate-ready opportunity.",
      ];
  return (
    <section className="recruiter-empty-state">
      <span className="recruiter-empty-state__icon">
        <Icon name="briefcase" />
      </span>
      <div>
        <h2>{copy[0]}</h2>
        <p>{copy[1]}</p>
      </div>
      <button
        type="button"
        className="recruiter-primary-button"
        onClick={onCreate}
      >
        <Icon name="plus" />
        {hasAnyJobs ? "Create a job posting" : "Create your first job posting"}
      </button>
    </section>
  );
}

function CompanyRequiredState() {
  return (
    <section className="recruiter-empty-state recruiter-company-required">
      <span className="recruiter-empty-state__icon">
        <Icon name="briefcase" />
      </span>
      <div>
        <h2>Company setup required</h2>
        <p>
          Link a recruiter-owned company before creating job postings. For local
          mock data, the company ownerUserId must match the signed-in user ID.
        </p>
      </div>
      <a
        className="recruiter-primary-button"
        href="/dashboard/employer-verification"
      >
        Set up company
      </a>
    </section>
  );
}

function CompanyProfileRequiredState({
  missingFields,
}: {
  missingFields: Array<"name" | "industry" | "size" | "address" | "logo">;
}) {
  const labels: Record<(typeof missingFields)[number], string> = {
    name: "Company name",
    industry: "Industry",
    size: "Company size",
    address: "Address",
    logo: "Company logo",
  };
  return (
    <section className="recruiter-empty-state recruiter-company-required">
      <span className="recruiter-empty-state__icon">
        <Icon name="briefcase" />
      </span>
      <div>
        <h2>Complete company profile before posting</h2>
        <p>
          Create job posting is locked until the following fields are complete.
        </p>
        <ul className="recruiter-company-required__list">
          {missingFields.map((field) => (
            <li key={field}>{labels[field]}</li>
          ))}
        </ul>
      </div>
      <Link
        className="recruiter-primary-button"
        href="/recruiter/company-settings?required=profile"
      >
        Open company settings
      </Link>
    </section>
  );
}

function withCompany(
  job: JobCatalogItem,
  companies: RecruiterCompanyView[],
): RecruiterJob {
  const company =
    companies.find((item) => item.id === job.companyId) ?? companies[0];
  if (!company) {
    throw new Error("Company data is required for recruiter jobs.");
  }
  return {
    ...job,
    company,
  };
}

function withCompanyFromState(
  job: JobCatalogItem,
  companies: RecruiterCompanyView[],
  existing?: RecruiterJobManagementData["jobs"],
): RecruiterJob {
  const company =
    existing?.find((item) => item.id === job.id)?.company ??
    companies.find((item) => item.id === job.companyId) ??
    companies[0];
  if (!company) {
    throw new Error("Company data is required for recruiter jobs.");
  }
  return {
    ...job,
    company,
  };
}
export function RecruiterJobPostingManagement({
  initialData,
  onNavigate,
}: {
  initialData?: RecruiterJobManagementData | null;
  onNavigate?: (href: string) => void;
} = {}) {
  const [data, setData] = useState<RecruiterJobManagementData | null>(
    initialData ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["value"]>("active");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [view, setView] = useState<"dashboard" | "editor" | "applicants">(
    "dashboard",
  );
  const [editorJob, setEditorJob] = useState<RecruiterJob | null>(null);
  const [applicantJob, setApplicantJob] = useState<RecruiterJob | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;

    const refresh = async (showLoading = false) => {
      if (cancelled || requestInFlight) return;
      requestInFlight = true;
      if (showLoading) setLoading(true);
      try {
        const next = await fetchRecruiterJobManagementData();
        if (!cancelled) setData(next);
      } catch {
        // Keep the last known data during background refreshes. If the first
        // request fails, preserve the existing empty-state behavior.
        if (showLoading && !cancelled) setData(emptyData);
      } finally {
        requestInFlight = false;
        if (showLoading && !cancelled) setLoading(false);
      }
    };

    if (!initialData) {
      void refresh(true);
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    const intervalId = window.setInterval(
      refreshWhenVisible,
      JOB_POSTINGS_REFRESH_INTERVAL_MS,
    );
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [initialData]);

  const current = data ?? emptyData;
  const companyReady = Boolean(current.companyId && current.companies.length);
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          current.jobs
            .map(
              (job) =>
                job.description.generalInfo.department || job.categoryFamily,
            )
            .filter(Boolean),
        ),
      ).sort(),
    [current.jobs],
  );
  const counts = useMemo(
    () => ({
      active: current.jobs.filter((job) => job.status === "active").length,
      applicants: current.jobs.reduce(
        (sum, job) => sum + job.stats.applicantCount,
        0,
      ),
      pending: current.jobs.filter((job) => job.status === "pending_approval")
        .length,
      closing: current.jobs.filter(isClosingSoon).length,
    }),
    [current.jobs],
  );
  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return current.jobs
      .filter((job) => statusForTab(job, activeTab))
      .filter(
        (job) =>
          department === "all" ||
          (job.description.generalInfo.department || job.categoryFamily) ===
            department,
      )
      .filter(
        (job) =>
          !query ||
          [
            job.title,
            job.description.generalInfo.department,
            job.categoryFamily,
            job.location.city,
            job.location.district,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [activeTab, current.jobs, department, search]);

  const openCreate = () => {
    if (current.companyProfileComplete === false) {
      if (onNavigate) {
        onNavigate("/recruiter/company-settings?required=profile");
      } else {
        setMessage("Complete your company profile before creating a posting.");
      }
      return;
    }
    if (!current.companyId) {
      setMessage("Link a recruiter-owned company before creating a posting.");
      return;
    }
    if (onNavigate) {
      onNavigate(recruiterRoutes.jobPostingCreate);
      return;
    }
    setEditorJob(
      withCompany(createEmptyJobPosting(current.companyId), current.companies),
    );
    setView("editor");
  };
  const openEdit = (job: RecruiterJob) => {
    if (onNavigate) {
      onNavigate(recruiterRoutes.jobPostingEdit(job.id));
      return;
    }
    setEditorJob(job);
    setView("editor");
  };
  const receiveSavedJob = (job: RecruiterJob) => {
    setData((currentData) => {
      const next = currentData ?? emptyData;
      const normalizedJob = withCompanyFromState(
        job,
        next.companies,
        next.jobs,
      );
      const exists = next.jobs.some((item) => item.id === job.id);
      return {
        ...next,
        jobs: exists
          ? next.jobs.map((item) =>
              item.id === normalizedJob.id ? normalizedJob : item,
            )
          : [normalizedJob, ...next.jobs],
      };
    });
    setMessage("Job posting saved to the mock database.");
    setView("dashboard");
    setActiveTab(
      job.status === "pending_approval"
        ? "pending_approval"
        : job.status === "closed"
          ? "closed"
          : job.status === "rejected"
            ? "draft"
            : job.status,
    );
  };
  const closeJob = async (job: RecruiterJob) => {
    const response = await fetch(
      "/api/recruiter/job-postings?jobId=" + encodeURIComponent(job.id),
      { method: "DELETE" },
    );
    const payload = (await response.json().catch(() => null)) as
      | (JobCatalogItem & { message?: string })
      | null;
    if (!response.ok || !payload) {
      setMessage(payload?.message ?? "Unable to close this posting.");
      return;
    }
    receiveSavedJob(
      withCompanyFromState(payload, current.companies, current.jobs),
    );
    setMessage("Job posting closed and saved to the mock database.");
  };

  const extendJob = async (job: RecruiterJob) => {
    const base = new Date(job.applyDeadline ?? job.updatedAt);
    base.setUTCDate(base.getUTCDate() + 30);
    const response = await fetch("/api/recruiter/job-postings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...job,
        status: "active",
        applyDeadline: base.toISOString(),
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (JobCatalogItem & { message?: string })
      | null;
    if (!response.ok || !payload) {
      setMessage(payload?.message ?? "Unable to extend this deadline.");
      return;
    }
    receiveSavedJob(
      withCompanyFromState(payload, current.companies, current.jobs),
    );
    setMessage("Application deadline extended by 30 days.");
  };
  if (view === "editor" && editorJob)
    return (
      <JobPostingEditor
        initialJob={editorJob}
        companyName={current.companies[0]?.name ?? "Your company"}
        onBack={() => setView("dashboard")}
        onSaved={receiveSavedJob}
      />
    );
  if (view === "applicants" && applicantJob)
    return (
      <CandidateRankingList
        jobId={applicantJob.id}
        jobTitle={applicantJob.title}
        onBack={() => setView("dashboard")}
        pipelineHref={recruiterRoutes.pipelineForJob(applicantJob.id)}
      />
    );

  if (!loading && current.companyProfileComplete === false) {
    return (
      <div className="recruiter-management">
        <header className="recruiter-management__heading">
          <div>
            <p className="recruiter-eyebrow">Recruiter workspace</p>
            <h1>Job postings</h1>
            <p>Complete the company identity before opening a new role.</p>
          </div>
          <button
            type="button"
            className="recruiter-primary-button"
            onClick={openCreate}
          >
            <Icon name="plus" />
            Create job posting
          </button>
        </header>
        <CompanyProfileRequiredState
          missingFields={
            current.missingCompanyProfileFields ?? [
              "name",
              "industry",
              "size",
              "address",
              "logo",
            ]
          }
        />
      </div>
    );
  }
  if (!loading && !companyReady) {
    return (
      <div className="recruiter-management">
        <header className="recruiter-management__heading">
          <div>
            <p className="recruiter-eyebrow">Recruiter workspace</p>
            <h1>Job postings</h1>
            <p>Manage every opening from first draft to a confident close.</p>
          </div>
          <button
            type="button"
            className="recruiter-primary-button"
            disabled
            title="Link a recruiter-owned company first"
          >
            <Icon name="plus" />
            Create job posting
          </button>
        </header>
        <CompanyRequiredState />
      </div>
    );
  }
  return (
    <div className="recruiter-management">
      <header className="recruiter-management__heading">
        <div>
          <p className="recruiter-eyebrow">Recruiter workspace</p>
          <h1>Job postings</h1>
          <p>Manage every opening from first draft to a confident close.</p>
        </div>
        <button
          type="button"
          className="recruiter-primary-button"
          onClick={openCreate}
        >
          <Icon name="plus" />
          Create job posting
        </button>
      </header>
      <section
        className="recruiter-stat-strip"
        aria-label="Job posting overview"
      >
        <StatCard
          label="Active jobs"
          value={counts.active}
          icon="briefcase"
          tone="blue"
        />
        <StatCard
          label="Total applicants"
          value={counts.applicants}
          icon="users"
          tone="teal"
        />
        <StatCard
          label="Pending approval"
          value={counts.pending}
          icon="clock"
          tone="amber"
        />
        <StatCard
          label="Closing soon"
          value={counts.closing}
          icon="calendar"
          tone="violet"
        />
      </section>
      <section className="recruiter-list-section">
        <div className="recruiter-section-heading">
          <div>
            <p className="recruiter-eyebrow">YOUR OPENINGS</p>
            <h2>Track your hiring pipeline</h2>
          </div>
          <span className="recruiter-live-status">
            <span />
            Live applicant counts
          </span>
        </div>
        <nav
          className="recruiter-tabs"
          role="tablist"
          aria-label="Job posting status"
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              className={activeTab === tab.value ? "is-active" : ""}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              <span>
                {
                  current.jobs.filter((job) => statusForTab(job, tab.value))
                    .length
                }
              </span>
            </button>
          ))}
        </nav>
        <div className="recruiter-filter-panel recruiter-surface-card">
          <label>
            <span>Search postings</span>
            <div className="recruiter-input-with-icon">
              <Icon name="search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or department"
              />
            </div>
          </label>
          <label>
            <span>Department</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            >
              <option value="all">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <JobListSkeleton />
          ) : filteredJobs.length ? (
            <div className="recruiter-job-list">
              {filteredJobs.map((job) => (
                <JobPostingCard
                  key={job.id}
                  job={job}
                  onEdit={() => openEdit(job)}
                  onApplicants={() => {
                    if (onNavigate) {
                      onNavigate(recruiterRoutes.candidateRanking(job.id));
                      return;
                    }
                    setApplicantJob(job);
                    setView("applicants");
                  }}
                  onClose={() => void closeJob(job)}
                  onExtend={() => void extendJob(job)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              hasAnyJobs={current.jobs.length > 0}
              tab={activeTab}
              onCreate={openCreate}
            />
          )}
        </div>
      </section>
      {message ? (
        <div className="recruiter-toast" role="status">
          <Icon name="check" />
          {message}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            <Icon name="close" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

type RecruiterNavIconName = Exclude<
  WorkspaceNavIconName,
  "messages" | "support" | "profile"
>;

export function RecruiterWorkspaceNavigation({
  collapsed,
  busy,
  onSignOut,
}: {
  collapsed: boolean;
  busy: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const destinations: Array<{
    label: string;
    icon: Exclude<RecruiterNavIconName, "signout">;
    href?: string;
    active: boolean;
  }> = [
    { label: "Overview", icon: "dashboard", active: false },
    {
      label: "Job postings",
      icon: "jobs",
      href: recruiterRoutes.jobPostings,
      active:
        pathname === "/recruiter" ||
        pathname === recruiterRoutes.jobPostings ||
        pathname.startsWith("/recruiter/jobs") ||
        pathname.startsWith(`${recruiterRoutes.jobPostings}/`),
    },
    {
      label: "Candidates",
      icon: "candidates",
      href: recruiterRoutes.candidates,
      active:
        pathname === recruiterRoutes.candidates ||
        pathname.startsWith(`${recruiterRoutes.candidates}/`),
    },
    {
      label: "Pipeline",
      icon: "pipeline",
      href: recruiterRoutes.pipeline,
      active:
        pathname === recruiterRoutes.pipeline ||
        pathname.startsWith(`${recruiterRoutes.pipeline}/`),
    },
    {
      label: "Company settings",
      icon: "settings",
      href: "/recruiter/company-settings",
      active: pathname === "/recruiter/company-settings",
    },
  ];
  return (
    <nav
      className="workspace-navigation recruiter-workspace-navigation"
      id="recruiter-workspace-navigation"
      aria-label="Recruiter workspace"
    >
      <span className="workspace-sidebar-width-sizer" aria-hidden="true">
        {destinations.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </span>
      <p className="workspace-nav-label">Recruiter workspace</p>
      <div className="workspace-navigation-scroll">
        {destinations.map((item) => {
          const content = (
            <>
              <WorkspaceNavIcon name={item.icon} />
              <span className="workspace-navigation-label">{item.label}</span>
              {!item.href ? (
                <span className="recruiter-nav-soon">Soon</span>
              ) : null}
            </>
          );
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              {content}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              title={collapsed ? item.label : undefined}
              disabled
            >
              {content}
            </button>
          );
        })}
      </div>
      <div className="workspace-navigation-footer">
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy}
          aria-busy={busy}
        >
          <WorkspaceNavIcon name="signout" />
          <span className="workspace-navigation-label">
            {busy ? "Signing out..." : "Sign out"}
          </span>
        </button>
      </div>
    </nav>
  );
}
