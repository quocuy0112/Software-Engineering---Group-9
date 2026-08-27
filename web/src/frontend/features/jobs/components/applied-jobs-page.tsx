"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applicationStageGroup,
  applicationStageSchema,
  candidateApplicationListResponseSchema,
  type ApplicationStage,
  type ApplicationStageGroup,
  type CandidateApplicationSummary,
} from "@/shared/contracts/jobs/applications";
import { EmptyState } from "./job-empty-state";
import { ApplicationStageBadge } from "./application-stage-badge";
import { CompanyAvatar } from "./company-avatar";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";

type GroupFilter = "ALL" | ApplicationStageGroup;

function scoringFailureMessage(
  code: CandidateApplicationSummary["scoringFailureCode"],
  locale: "vi" | "en",
) {
  if (locale === "vi") {
    switch (code) {
      case "SCORING_CV_TEXT_UNAVAILABLE":
      case "CV_TEXT_UNAVAILABLE":
      case "CV_TEXT_TOO_SHORT":
      case "CV_TEXT_INVALID":
        return "Không thể đọc nội dung từ tệp này. Hãy đảm bảo đây là CV dạng văn bản, không phải ảnh quét.";
      case "CV_NOT_RECOGNIZED_AS_CV":
        return "Tệp đã tải lên không có vẻ là một CV hợp lệ. Hãy tải lên tệp có thông tin về kinh nghiệm, học vấn và kỹ năng.";
      case "CV_CLASSIFICATION_TIMEOUT":
        return "Xác minh CV mất quá nhiều thời gian. Hãy tải tệp lên lại.";
      case "CV_CLASSIFICATION_UNAVAILABLE":
      case "CV_CLASSIFICATION_MALFORMED":
      case "CV_CLASSIFICATION_NOT_CONFIGURED":
        return "Không thể xác minh CV lúc này. Hãy thử tải lên lại.";
      case "SCORING_TIMEOUT":
      case "SCORING_RETRY_LIMIT_REACHED":
        return "Phân tích CV mất quá nhiều thời gian. Hãy tải CV lên lại.";
      default:
        return "Phân tích CV không thành công. Hãy tải CV lên lại.";
    }
  }
  switch (code) {
    case "SCORING_CV_TEXT_UNAVAILABLE":
    case "CV_TEXT_UNAVAILABLE":
    case "CV_TEXT_TOO_SHORT":
    case "CV_TEXT_INVALID":
      return "We couldn't read any content from this file. Please make sure it's a text-based CV, not a scanned image.";
    case "CV_NOT_RECOGNIZED_AS_CV":
      return "The uploaded file does not appear to be a valid CV. Please upload a file containing your resume information (work experience, education, skills, etc.).";
    case "CV_CLASSIFICATION_TIMEOUT":
      return "CV verification took too long. Please upload the file again.";
    case "CV_CLASSIFICATION_UNAVAILABLE":
    case "CV_CLASSIFICATION_MALFORMED":
    case "CV_CLASSIFICATION_NOT_CONFIGURED":
      return "We couldn't verify this CV right now. Please try uploading it again.";
    case "SCORING_TIMEOUT":
    case "SCORING_RETRY_LIMIT_REACHED":
      return "CV scoring took too long to finish. Please upload your CV again.";
    default:
      return "CV analysis failed. Please upload your CV again.";
  }
}

function groupFilters(
  copy: ReturnType<typeof applicationCopy>["applicationsList"],
): Array<{ id: GroupFilter; label: string }> {
  return [
    { id: "ALL", label: copy.filters.all },
    { id: "ACTIVE", label: copy.filters.applicationSubmitted },
    { id: "ATTENTION", label: copy.filters.outcome },
    { id: "PAUSED", label: copy.filters.underReview },
    { id: "COMPLETED", label: copy.filters.terminal },
  ];
}

function formatDate(value: string, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function groupCount(
  applications: CandidateApplicationSummary[],
  group: GroupFilter,
) {
  return group === "ALL"
    ? applications.length
    : applications.filter(
        (application) => applicationStageGroup[application.stage] === group,
      ).length;
}

export function ApplicationFilters({
  applications,
  activeGroup,
  activeStage,
  onGroupChange,
  onStageChange,
}: {
  applications: CandidateApplicationSummary[];
  activeGroup: GroupFilter;
  activeStage: "ALL" | ApplicationStage;
  onGroupChange: (group: GroupFilter) => void;
  onStageChange: (stage: "ALL" | ApplicationStage) => void;
}) {
  const copy = applicationCopy(useWorkspaceLocale());
  const listCopy = copy.applicationsList;
  const filters = groupFilters(listCopy);
  return (
    <div className="application-filters">
      <div className="application-group-tabs" aria-label={listCopy.groupAria}>
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeGroup === filter.id ? "is-active" : undefined}
            aria-pressed={activeGroup === filter.id}
            onClick={() => onGroupChange(filter.id)}
          >
            {filter.label}
            <span>{groupCount(applications, filter.id)}</span>
          </button>
        ))}
      </div>
      <label className="application-stage-filter">
        <span>{listCopy.stage}</span>
        <select
          value={activeStage}
          onChange={(event) =>
            onStageChange(event.target.value as "ALL" | ApplicationStage)
          }
        >
          <option value="ALL">{listCopy.allStages}</option>
          {applicationStageSchema.options.map((stage) => (
            <option key={stage} value={stage}>
              {listCopy.statuses[stage]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ApplicationCard({
  application,
}: {
  application: CandidateApplicationSummary;
}) {
  const locale = useWorkspaceLocale();
  const copy = applicationCopy(locale);
  const listCopy = copy.applicationsList;
  const stageNextStep = copy.stageNextStep;
  const title =
    application.jobAvailable && application.jobSlug ? (
      <Link href={`/jobs/${application.jobSlug}`}>{application.jobTitle}</Link>
    ) : (
      application.jobTitle
    );

  return (
    <article className="application-tracking-card">
      <CompanyAvatar
        name={application.companyName}
        imageUrl={application.companyLogoUrl}
        size="lg"
        className="application-company-mark"
      />
      <div className="application-card-main">
        <div className="application-card-title-row">
          <div>
            <p className="application-company-name">
              {application.companyName}
            </p>
            <h2>{title}</h2>
          </div>
          <ApplicationStageBadge stage={application.stage} />
        </div>

        <div
          className="application-card-meta"
          aria-label={listCopy.applicationDetails}
        >
          <span>{application.location}</span>
          <span>
            {listCopy.applied(formatDate(application.submittedAt, locale))}
          </span>
          <span>
            {listCopy.updated(
              formatDate(application.lastStageChangedAt, locale),
            )}
          </span>
        </div>

        {!application.jobAvailable ? (
          <p className="application-unavailable-note">{listCopy.unavailable}</p>
        ) : null}

        <div className="application-next-step">
          <span aria-hidden="true">i</span>
          <p>{stageNextStep[application.stage]}</p>
        </div>

        <footer>
          <div>
            {application.scoringStatus === "FAILED" ? (
              <p className="application-scoring-error" role="alert">
                {scoringFailureMessage(application.scoringFailureCode, locale)}{" "}
                {application.jobAvailable && application.jobSlug ? (
                  <Link href={"/jobs/" + application.jobSlug + "/apply"}>
                    {listCopy.reuploadCv}
                  </Link>
                ) : (
                  listCopy.contactSupport
                )}
              </p>
            ) : application.scoringStatus &&
              application.scoringStatus !== "NOT_REQUESTED" ? (
              <span className="application-scoring-status">
                {listCopy.cvAnalysis}: {application.scoringStatus.toLowerCase()}
              </span>
            ) : null}
          </div>
          <Link
            className="application-detail-link"
            href={`/jobs/applied/${encodeURIComponent(application.applicationId)}`}
          >
            {listCopy.viewApplication}
            <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </div>
    </article>
  );
}

export function AppliedJobsPage({
  applications,
  nextCursor: initialNextCursor = null,
}: {
  applications: CandidateApplicationSummary[];
  nextCursor?: string | null;
}) {
  const locale = useWorkspaceLocale();
  const copy = applicationCopy(locale);
  const listCopy = copy.applicationsList;
  const [loadedApplications, setLoadedApplications] = useState(applications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("ALL");
  const [activeStage, setActiveStage] = useState<"ALL" | ApplicationStage>(
    "ALL",
  );
  const filtered = useMemo(
    () =>
      loadedApplications.filter(
        (application) =>
          (activeGroup === "ALL" ||
            applicationStageGroup[application.stage] === activeGroup) &&
          (activeStage === "ALL" || application.stage === activeStage),
      ),
    [activeGroup, activeStage, loadedApplications],
  );

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const query = new URLSearchParams({ cursor: nextCursor, limit: "24" });
      const response = await fetch(`/api/candidate/applications?${query}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("APPLICATION_LIST_REQUEST_FAILED");
      const result = candidateApplicationListResponseSchema.parse(
        await response.json(),
      );
      setLoadedApplications((current) => {
        const known = new Set(current.map((item) => item.applicationId));
        return [
          ...current,
          ...result.applications.filter(
            (item) => !known.has(item.applicationId),
          ),
        ];
      });
      setNextCursor(result.nextCursor);
    } catch {
      setLoadMoreError(listCopy.loadMoreError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      className="jobs-workspace-section applications-workspace"
      aria-labelledby="applied-jobs-heading"
    >
      <header className="jobs-workspace-heading applications-heading">
        <div>
          <p className="workspace-kicker">{listCopy.eyebrow}</p>
          <h1 id="applied-jobs-heading">{listCopy.title}</h1>
          <p>{listCopy.subtitle}</p>
        </div>
        <span
          className="jobs-workspace-count"
          aria-label={listCopy.applicationsLoaded(loadedApplications.length)}
        >
          {loadedApplications.length}
        </span>
      </header>

      {loadedApplications.length ? (
        <>
          <ApplicationFilters
            applications={loadedApplications}
            activeGroup={activeGroup}
            activeStage={activeStage}
            onGroupChange={setActiveGroup}
            onStageChange={setActiveStage}
          />
          {filtered.length ? (
            <div className="application-card-list">
              {filtered.map((application) => (
                <ApplicationCard
                  key={application.applicationId}
                  application={application}
                />
              ))}
            </div>
          ) : (
            <div className="workspace-inline-empty application-filter-empty">
              <p>{listCopy.noMatchesTitle}</p>
              <button
                type="button"
                onClick={() => {
                  setActiveGroup("ALL");
                  setActiveStage("ALL");
                }}
              >
                {listCopy.clearFilters}
              </button>
            </div>
          )}
          {nextCursor ? (
            <div className="application-load-more">
              <button
                type="button"
                disabled={loadingMore}
                aria-busy={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? listCopy.loading : listCopy.loadMore}
              </button>
            </div>
          ) : null}
          {loadMoreError ? (
            <p className="application-load-more-error" role="alert">
              {loadMoreError}
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          illustration="headset"
          title={listCopy.emptyTitle}
          description={listCopy.emptyDescription}
          cta={{ href: "/jobs", label: listCopy.browseJobs }}
        />
      )}
    </section>
  );
}
