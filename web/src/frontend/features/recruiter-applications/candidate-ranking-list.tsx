"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CircleX,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  useRankedCandidates,
  type RankedCandidateQuery,
} from "./use-ranked-candidates";
import { CandidateScoreDrawer } from "./candidate-score-drawer";
import { RescoreConfirmModal } from "./rescore-confirm-modal";
import { ManualPriorityModal } from "./manual-priority-modal";
import { StageTransitionConfirmModal } from "./stage-transition-confirm-modal";
import { RejectCandidateModal } from "./reject-candidate-modal";
import {
  EmptyCandidatesIllustration,
  formatScore,
  formatTableScore,
  RankingSkeleton,
  ScoreBadge,
  scoreBadgeForRow,
  StatCard,
  statusLabel,
} from "./candidate-ranking-ui";
import {
  applicationShortlistOutcomeSchema,
  applicationViewedOutcomeSchema,
} from "@/shared/contracts/jobs/applications";
import {
  recruiterApplicationsCopy,
  type RecruiterApplicationsCopy,
} from "./recruiter-applications-copy";

const defaultQuery: RankedCandidateQuery = {
  sort: "FINAL_SCORE",
  stage: "ACTIVE_PIPELINE",
  scoringStatus: "ALL",
};

function formatLastScoredAt(
  value: string | null | undefined,
  locale: "vi" | "en",
  copy: RecruiterApplicationsCopy["ranking"],
) {
  if (!value) return copy.notScored;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.unavailable;
  const dateLocale = locale === "vi" ? "vi-VN" : "en-GB";
  return `${date.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  })}, ${date.toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

type RankingPaginationItem = number | "ellipsis";

function rankingPaginationItems(
  pageCount: number,
  pageIndex: number,
): RankingPaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const visiblePages = new Set([0, pageCount - 1, pageIndex]);
  if (pageIndex > 0) visiblePages.add(pageIndex - 1);
  if (pageIndex < pageCount - 1) visiblePages.add(pageIndex + 1);
  const sortedPages = Array.from(visiblePages).sort(
    (left, right) => left - right,
  );
  const items: RankingPaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function Pagination({
  pageIndex,
  pageSize,
  total,
  hasPrevious,
  hasNext,
  onPage,
  onPrevious,
  onNext,
  onPageSize,
  copy,
}: {
  pageIndex: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPage: (pageIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPageSize: (value: number) => void;
  copy: RecruiterApplicationsCopy["ranking"];
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="ranking-pagination">
      <span>{copy.pagination.showing(start, end, total)}</span>
      <label className="ranking-pagination__page-size">
        <span className="sr-only">{copy.pagination.perPage}</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
        </select>
      </label>
      <nav className="ranking-pager" aria-label={copy.paginationLabel}>
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          aria-label={copy.pagination.previous}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        {rankingPaginationItems(pageCount, pageIndex).map((item, index) =>
          item === "ellipsis" ? (
            <span
              className="ranking-pager__ellipsis"
              key={`ellipsis-${index}`}
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              type="button"
              className={item === pageIndex ? "is-current" : undefined}
              key={item}
              onClick={() => onPage(item)}
              aria-label={copy.pagination.page(item + 1)}
              aria-current={item === pageIndex ? "page" : undefined}
            >
              {item + 1}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label={copy.pagination.next}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}

function RankingLoadingState({
  copy,
}: {
  copy: RecruiterApplicationsCopy["ranking"];
}) {
  return (
    <div
      className="ranking-loading-state"
      role="status"
      aria-label={copy.loading}
    >
      <div className="ranking-loading-state__stats">
        {(
          [
            copy.stats.total,
            copy.stats.strong,
            copy.stats.review,
            copy.stats.low,
            copy.stats.processing,
          ] as const
        ).map((label) => (
          <article className="ranking-stat-card" key={label}>
            <RankingSkeleton className="ranking-skeleton--dot" />
            <span className="ranking-stat-card__content">
              <RankingSkeleton className="ranking-skeleton--stat" />
              <span>{label}</span>
            </span>
          </article>
        ))}
      </div>
      <div className="ranking-loading-state__table">
        <div className="ranking-skeleton ranking-skeleton--table-head" />
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            className="ranking-skeleton ranking-skeleton--table-row"
            key={item}
          />
        ))}
      </div>
      <span className="ranking-loading-state__label">
        <LoaderCircle aria-hidden="true" className="is-spinning" />{" "}
        {copy.preparing}
      </span>
    </div>
  );
}

function RankingErrorState({
  message,
  onRetry,
  copy,
}: {
  message: string;
  onRetry: () => void;
  copy: RecruiterApplicationsCopy["ranking"];
}) {
  return (
    <div className="ranking-empty-state" role="alert">
      <CircleX aria-hidden="true" />
      <h2>{copy.loadError}</h2>
      <p>{message}</p>
      <button
        type="button"
        className="ai-ranking-button ai-ranking-button--secondary"
        onClick={onRetry}
      >
        {copy.retry}
      </button>
    </div>
  );
}

function CandidateRow({
  row,
  rank,
  onOpen,
  copy,
  locale,
}: {
  row: RankedApplicationRow;
  rank: number;
  onOpen: () => void;
  copy: RecruiterApplicationsCopy["ranking"];
  locale: "vi" | "en";
}) {
  const badge = scoreBadgeForRow(row, locale);
  const isProcessing =
    row.scoring.kind === "PROCESSING" || row.scoring.kind === "PENDING";
  const skills = row.skills.slice(0, 2);
  const extraSkills = Math.max(0, row.skills.length - skills.length);
  const skillsLabel = row.skills.join(", ");
  return (
    <div
      className={["ranking-table__row", isProcessing && "is-processing"]
        .filter(Boolean)
        .join(" ")}
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span
        className="ranking-table__cell ranking-table__rank"
        role="cell"
        data-label={copy.table.rank}
      >
        {rank}
      </span>
      <span
        className="ranking-table__cell ranking-candidate-cell"
        role="cell"
        data-label={copy.table.candidate}
      >
        <span className="ranking-avatar" aria-hidden="true">
          {row.candidate.displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="ranking-candidate-cell__copy">
          <strong>{row.candidate.displayName}</strong>
          <small>{row.candidate.verifiedEmail}</small>
          {row.manuallyPrioritized ? (
            <span className="ranking-manual-priority">
              <Plus aria-hidden="true" /> {copy.table.manuallyPrioritized}
            </span>
          ) : null}
        </span>
      </span>
      <span
        className="ranking-table__cell"
        role="cell"
        data-label={copy.table.status}
      >
        <span
          className={[
            "ranking-status-pill",
            row.withdrawalOutcome === "CANDIDATE_WITHDRAWN" &&
              "ranking-status-pill--withdrawn",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {statusLabel(row.stage, row.withdrawalOutcome, locale)}
        </span>
      </span>
      <span
        className="ranking-table__cell ranking-table__experience"
        role="cell"
        data-label={copy.table.experience}
      >
        {isProcessing || row.experienceYears === null ? (
          <span className="ranking-muted-text">{"\u2014"}</span>
        ) : (
          `${row.experienceYears} ${copy.table.year}${row.experienceYears === 1 ? "" : locale === "vi" ? "" : "s"}`
        )}
      </span>
      <span
        className="ranking-table__cell ranking-skills-cell"
        role="cell"
        data-label={copy.table.keySkills}
      >
        {skills.length ? (
          <span
            className="ranking-skills-text"
            title={skillsLabel}
            aria-label={skillsLabel}
          >
            {skills.join(", ")}
            {extraSkills ? ` ${copy.table.more(extraSkills)}` : ""}
          </span>
        ) : (
          <span className="ranking-muted-text">
            {row.scoring.kind === "PROCESSING" || row.scoring.kind === "PENDING"
              ? copy.table.extractingSkills
              : copy.table.notDetected}
          </span>
        )}
      </span>
      <span
        className="ranking-table__cell ranking-score-number"
        role="cell"
        data-label={copy.table.autoMatch}
      >
        {isProcessing ? "\u2014" : formatTableScore(row.scoreSummary.automatic)}
      </span>
      <span
        className="ranking-table__cell ranking-score-number ranking-score-number--ai"
        role="cell"
        data-label={copy.table.ai}
      >
        {isProcessing ? "\u2014" : formatTableScore(row.scoreSummary.ai)}
      </span>
      <span
        className="ranking-table__cell ranking-final-score"
        role="cell"
        data-label={copy.table.finalScore}
      >
        <strong>
          {isProcessing ? "\u2014" : formatScore(row.scoreSummary.final)}
        </strong>
        <ScoreBadge meta={badge} compact />
      </span>
      <span
        className="ranking-table__cell ranking-applied-date"
        role="cell"
        data-label={copy.table.applied}
      >
        <time dateTime={row.submittedAt}>
          {new Date(row.submittedAt).toLocaleDateString(
            locale === "vi" ? "vi-VN" : "en-US",
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
            },
          )}
        </time>
      </span>
    </div>
  );
}

export function CandidateRankingList({
  jobId,
  jobTitle,
  onBack,
  backHref,
  csrfProof,
  pipelineHref,
}: {
  jobId: string;
  jobTitle: string;
  onBack?: () => void;
  backHref?: string;
  csrfProof?: string;
  pipelineHref?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruiterApplicationsCopy(locale).ranking;
  const contextCsrfProof = useCsrfProof();
  const effectiveCsrfProof = csrfProof ?? contextCsrfProof;
  const [query, setQuery] = useState<RankedCandidateQuery>(defaultQuery);
  const [pageSize, setPageSize] = useState(10);
  const [searchDraft, setSearchDraft] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const [selected, setSelected] = useState<RankedApplicationRow | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [modal, setModal] = useState<
    "rescore" | "priority" | "interview" | "reject" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const ranking = useRankedCandidates(jobId, query, pageSize, locale);
  const page = ranking.page;
  const {
    loading: rankingLoading,
    refreshing: rankingRefreshing,
    refresh: refreshRanking,
  } = ranking;

  useEffect(() => {
    if (!page?.rescoreInProgress) return;
    const timer = window.setInterval(() => {
      if (!rankingLoading) refreshRanking();
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [page?.rescoreInProgress, rankingLoading, refreshRanking]);

  const updateQuery = (patch: Partial<RankedCandidateQuery>) =>
    setQuery((current) => ({ ...current, ...patch }));
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({
      search: searchDraft.trim() || undefined,
      skill: skillDraft.trim() || undefined,
    });
  };
  const clearFilters = () => {
    setSearchDraft("");
    setSkillDraft("");
    setQuery(defaultQuery);
  };
  const finishAction = (nextMessage: string) => {
    setModal(null);
    setSelected(null);
    setSelectedRank(null);
    setMessage(nextMessage);
    ranking.refresh();
  };
  const acknowledgeCandidateOpened = async (row: RankedApplicationRow) => {
    if (row.stage !== "APPLIED") return;
    try {
      const response = await mutateWithCurrentCsrf(
        `/api/recruiter/applications/${encodeURIComponent(row.applicationId)}/view`,
        {
          method: "POST",
        },
        effectiveCsrfProof,
      );
      if (!response.ok) return;
      const result = applicationViewedOutcomeSchema.parse(
        await response.json(),
      );
      setSelected((current) =>
        current?.applicationId === row.applicationId
          ? {
              ...current,
              stage: result.stage,
              stageVersion: result.stageVersion,
            }
          : current,
      );
      // The stage transition changes the authoritative row and the candidate
      // table must stop showing the cached Applied/New state immediately.
      ranking.refresh();
    } catch {
      // Opening the candidate remains available if the acknowledgement fails;
      // the scoring/document read fallback can still acknowledge the review.
    }
  };
  const openRecruitmentChat = async (row: RankedApplicationRow) => {
    const response = await mutateWithCurrentCsrf(
      `/api/recruiter/applications/${encodeURIComponent(row.applicationId)}/recruitment-thread`,
      { method: "POST" },
      effectiveCsrfProof,
    );
    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      code?: string;
    } | null;
    if (!response.ok || !payload?.id) {
      throw new Error(
        payload?.code === "APPLICATION_NOT_READY"
          ? copy.actionMessages.conversationNotReady
          : copy.actionMessages.conversationUnavailable,
      );
    }
    window.location.assign(
      `${recruiterRoutes.messages}?thread=${encodeURIComponent(payload.id)}`,
    );
  };
  const shortlistCandidate = async (row: RankedApplicationRow) => {
    if (row.stage !== "VIEWED") return;
    const response = await mutateWithCurrentCsrf(
      `/api/recruiter/applications/${encodeURIComponent(row.applicationId)}/shortlist`,
      { method: "POST" },
      effectiveCsrfProof,
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(copy.actionMessages.shortlistFailed);
    }
    const result = applicationShortlistOutcomeSchema.parse(payload);
    setSelected((current) =>
      current?.applicationId === row.applicationId
        ? {
            ...current,
            stage: result.stage,
            stageVersion: result.stageVersion,
          }
        : current,
    );
    ranking.refresh();
  };
  const openRow = (row: RankedApplicationRow, rank: number) => {
    setMessage(null);
    setSelected(row);
    setSelectedRank(rank);
  };
  const setScoreRange = (range: string) => {
    if (!range)
      return updateQuery({ minScore: undefined, maxScore: undefined });
    const [min, max] = range.split("-").map(Number);
    updateQuery({ minScore: min, maxScore: max });
  };
  const resultCount = page?.filteredCandidates ?? 0;
  const skillOptions = Array.from(
    new Set([
      "React",
      "TypeScript",
      "JavaScript",
      "Python",
      "SQL",
      "Node.js",
      ...(page?.items.flatMap((row) => row.skills) ?? []),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <section
      className="ai-ranking-workspace"
      aria-labelledby="candidate-ranking-title"
    >
      <header className="ai-ranking-page-header">
        <div>
          <nav className="ranking-breadcrumbs" aria-label={copy.breadcrumb}>
            <Link href={recruiterRoutes.jobPostings}>{copy.recruitment}</Link>
            <span aria-hidden="true">/</span>
            <Link href={recruiterRoutes.candidates}>{copy.campaigns}</Link>
            <span aria-hidden="true">/</span>
            {backHref ? (
              <Link href={backHref}>{jobTitle}</Link>
            ) : onBack ? (
              <button
                type="button"
                className="ranking-breadcrumbs__button"
                onClick={onBack}
              >
                {jobTitle}
              </button>
            ) : (
              <Link href={recruiterRoutes.candidates}>{jobTitle}</Link>
            )}
            <span aria-hidden="true">/</span>
            <span aria-current="page">{copy.candidates}</span>
          </nav>
          <h1 id="candidate-ranking-title">
            Candidates {"\u2013"} {jobTitle}
          </h1>
          <p className="ranking-last-scored">
            {page?.totalCandidates?.toLocaleString(
              locale === "vi" ? "vi-VN" : "en-US",
            ) ?? "\u2014"}{" "}
            {copy.applications} {"\u00b7"} {copy.lastScored}:{" "}
            {formatLastScoredAt(page?.lastScoredAt, locale, copy)}
          </p>
        </div>
        <div className="ranking-header-actions">
          {pipelineHref ? (
            <Link
              href={pipelineHref}
              className="ai-ranking-button ai-ranking-button--secondary"
            >
              {copy.viewPipeline}
            </Link>
          ) : null}
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={() => refreshRanking()}
            disabled={rankingLoading || rankingRefreshing}
          >
            <RefreshCw
              aria-hidden="true"
              className={rankingRefreshing ? "is-spinning" : undefined}
            />
            {rankingRefreshing ? copy.refreshing : copy.refresh}
          </button>
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--primary ranking-rescore-button"
            onClick={() => setModal("rescore")}
            disabled={Boolean(page?.rescoreInProgress)}
          >
            <RefreshCw
              aria-hidden="true"
              className={page?.rescoreInProgress ? "is-spinning" : undefined}
            />
            {page?.rescoreInProgress ? copy.rescoring : copy.rescoreCandidates}
          </button>
        </div>
      </header>

      {message ? (
        <div className="ranking-toast" role="status">
          <span>
            <CheckCircle2 aria-hidden="true" /> {message}
          </span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label={copy.dismissMessage}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {page?.rescoreInProgress ? (
        <div className="ranking-progress-banner" role="status">
          <RefreshCw aria-hidden="true" className="is-spinning" />
          <span>
            <strong>{copy.rescoreProgress}</strong>{" "}
            {copy.rescoreProgressDescription}
          </span>
        </div>
      ) : null}

      {!page ? (
        ranking.error ? (
          <RankingErrorState
            message={copy.loadError}
            onRetry={ranking.retry}
            copy={copy}
          />
        ) : (
          <RankingLoadingState copy={copy} />
        )
      ) : (
        <>
          <div className="ranking-summary-grid">
            <StatCard
              icon={CircleDot}
              label={copy.stats.total}
              value={page?.summary.total}
              tone="blue"
            />
            <StatCard
              icon={CheckCircle2}
              label={copy.stats.strong}
              value={page?.summary.strong}
              tone="green"
            />
            <StatCard
              icon={AlertCircle}
              label={copy.stats.review}
              value={page?.summary.review}
              tone="amber"
            />
            <StatCard
              icon={CircleX}
              label={copy.stats.low}
              value={page?.summary.low}
              tone="red"
            />
            <StatCard
              icon={LoaderCircle}
              label={copy.stats.processing}
              value={page?.summary.processing}
              tone="purple"
            />
          </div>

          <form className="ranking-filter-bar" onSubmit={submitSearch}>
            <div className="ranking-filter-row ranking-filter-row--primary">
              <label className="ranking-filter-field ranking-search-field">
                <span>{copy.filters.search}</span>
                <span className="ranking-input-wrap">
                  <Search aria-hidden="true" />
                  <input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder={copy.filters.searchPlaceholder}
                  />
                </span>
              </label>
              <label className="ranking-filter-field">
                <span>{copy.filters.totalScore}</span>
                <select
                  aria-label={copy.filters.totalScore}
                  value={
                    query.minScore === undefined
                      ? ""
                      : `${query.minScore}-${query.maxScore ?? 100}`
                  }
                  onChange={(event) => setScoreRange(event.target.value)}
                >
                  <option value="">{copy.filters.anyScore}</option>
                  <option value="80-100">80–100</option>
                  <option value="60-79.99">60–79.99</option>
                  <option value="0-59.99">0–59.99</option>
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>{copy.filters.requiredSkills}</span>
                <select
                  aria-label={copy.filters.requiredSkills}
                  value={skillDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSkillDraft(value);
                    updateQuery({ skill: value || undefined });
                  }}
                >
                  <option value="">{copy.filters.anyRequiredSkill}</option>
                  {skillOptions.map((skill) => (
                    <option value={skill} key={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>{copy.filters.experience}</span>
                <select
                  value={
                    query.minExperience === undefined ? "" : query.minExperience
                  }
                  onChange={(event) =>
                    updateQuery({
                      minExperience: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                >
                  <option value="">{copy.filters.anyExperience}</option>
                  <option value="1">{copy.filters.years(1)}</option>
                  <option value="3">{copy.filters.years(3)}</option>
                  <option value="5">{copy.filters.years(5)}</option>
                  <option value="8">{copy.filters.years(8)}</option>
                </select>
              </label>
              <button
                type="button"
                className="ranking-clear-filters"
                onClick={clearFilters}
              >
                <X aria-hidden="true" /> {copy.filters.clearFilters}
              </button>
            </div>
            <div className="ranking-filter-row ranking-filter-row--secondary">
              <label className="ranking-filter-field">
                <span>{copy.filters.recruitmentStatus}</span>
                <select
                  value={query.stage}
                  onChange={(event) =>
                    updateQuery({
                      stage: event.target
                        .value as RankedCandidateQuery["stage"],
                    })
                  }
                >
                  <option value="ACTIVE_PIPELINE">
                    {copy.filters.activePipeline}
                  </option>
                  <option value="ALL">{copy.filters.allStatuses}</option>
                  <option value="APPLIED">{copy.filters.new}</option>
                  <option value="VIEWED">{copy.filters.viewed}</option>
                  <option value="SHORTLISTED">
                    {copy.filters.shortlisted}
                  </option>
                  <option value="WAITLISTED">
                    {copy.filters.needsDetails}
                  </option>
                  <option value="INTERVIEWING">
                    {copy.filters.interviewing}
                  </option>
                  <option value="REJECTED">{copy.filters.rejected}</option>
                  <option value="WITHDRAWN">{copy.filters.withdrawn}</option>
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>{copy.filters.scoringStatus}</span>
                <select
                  value={query.scoringStatus}
                  onChange={(event) =>
                    updateQuery({
                      scoringStatus: event.target
                        .value as RankedCandidateQuery["scoringStatus"],
                    })
                  }
                >
                  <option value="ALL">{copy.filters.allScoringStates}</option>
                  <option value="PROCESSING">{copy.filters.processing}</option>
                  <option value="SCORED">{copy.filters.scored}</option>
                  <option value="UNAVAILABLE">
                    {copy.filters.aiUnavailable}
                  </option>
                  <option value="FAILED">{copy.filters.scoringFailed}</option>
                  <option value="NOT_CALCULATED">
                    {copy.filters.notCalculated}
                  </option>
                </select>
              </label>
              <p className="ranking-filter-results" role="status">
                {copy.filters.resultCount(resultCount)}
              </p>
              <label className="ranking-filter-field ranking-sort-field">
                <span>{copy.filters.sortBy}</span>
                <span className="ranking-input-wrap">
                  <SlidersHorizontal aria-hidden="true" />
                  <select
                    value={query.sort}
                    onChange={(event) =>
                      updateQuery({
                        sort: event.target
                          .value as RankedCandidateQuery["sort"],
                      })
                    }
                  >
                    <option value="FINAL_SCORE">
                      {copy.filters.highestFinalScore}
                    </option>
                    <option value="MANUAL_PRIORITY">
                      {copy.filters.manualPriority}
                    </option>
                    <option value="SUBMITTED_AT">
                      {copy.filters.mostRecentlyApplied}
                    </option>
                  </select>
                </span>
              </label>
            </div>
          </form>

          <div
            className="ai-ranking-human-banner ranking-trust-banner"
            role="note"
          >
            <Info aria-hidden="true" />
            <span>
              <strong>{copy.trustTitle}</strong> {copy.trustDescription}
            </span>
          </div>

          {ranking.error ? (
            <RankingErrorState
              message={copy.loadError}
              onRetry={ranking.retry}
              copy={copy}
            />
          ) : page && page.items.length === 0 ? (
            <div className="ranking-empty-state">
              <EmptyCandidatesIllustration />
              <h2>
                {resultCount < (page?.totalCandidates ?? 0)
                  ? copy.empty.filteredTitle
                  : copy.empty.noCandidatesTitle}
              </h2>
              <p>
                {resultCount < (page?.totalCandidates ?? 0)
                  ? copy.empty.filteredDescription
                  : copy.empty.noCandidatesDescription}
              </p>
              {resultCount < (page?.totalCandidates ?? 0) ? (
                <button
                  type="button"
                  className="ai-ranking-button ai-ranking-button--secondary"
                  onClick={clearFilters}
                >
                  {copy.filters.clearFilters}
                </button>
              ) : null}
            </div>
          ) : page ? (
            <div className="ranking-table-shell" aria-busy={ranking.loading}>
              <div
                className="ranking-table"
                role="table"
                aria-label={copy.candidates}
              >
                <div className="ranking-table__head" role="row">
                  {[
                    copy.table.rank,
                    copy.table.candidate,
                    copy.table.status,
                    copy.table.experience,
                    copy.table.keySkills,
                    copy.table.autoMatch,
                    copy.table.ai,
                    copy.table.finalScore,
                    copy.table.applied,
                  ].map((heading) => (
                    <span role="columnheader" key={heading}>
                      {heading}
                    </span>
                  ))}
                </div>
                {page.items.map((row, index) => (
                  <CandidateRow
                    key={row.applicationId}
                    row={row}
                    rank={index + 1 + ranking.pageIndex * pageSize}
                    copy={copy}
                    locale={locale}
                    onOpen={() =>
                      openRow(row, index + 1 + ranking.pageIndex * pageSize)
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          {page && page.items.length ? (
            <Pagination
              pageIndex={ranking.pageIndex}
              pageSize={pageSize}
              total={resultCount}
              hasPrevious={ranking.hasPrevious}
              hasNext={ranking.hasNext}
              onPage={ranking.goToPage}
              onPrevious={ranking.previous}
              onNext={ranking.next}
              onPageSize={setPageSize}
              copy={copy}
            />
          ) : null}
        </>
      )}

      {selected ? (
        <CandidateScoreDrawer
          jobId={jobId}
          jobTitle={jobTitle}
          candidate={selected}
          onClose={() => {
            setSelected(null);
            setSelectedRank(null);
          }}
          onSetPriority={() => setModal("priority")}
          onShortlist={() => shortlistCandidate(selected)}
          onMoveToInterview={() => setModal("interview")}
          onReject={() => setModal("reject")}
          onApplicationOpened={() => acknowledgeCandidateOpened(selected)}
          onOpenRecruitmentChat={() => openRecruitmentChat(selected)}
          onScoringChanged={ranking.refresh}
        />
      ) : null}
      {modal === "rescore" ? (
        <RescoreConfirmModal
          jobId={jobId}
          jobTitle={jobTitle}
          totalCount={page?.totalCandidates ?? 0}
          onCancel={() => setModal(null)}
          onCompleted={() => finishAction(copy.actionMessages.rescoreStarted)}
        />
      ) : null}
      {modal === "priority" && selected ? (
        <ManualPriorityModal
          candidate={selected}
          suggestedRank={selectedRank ?? undefined}
          onCancel={() => setModal(null)}
          onCompleted={() => finishAction(copy.actionMessages.prioritySaved)}
        />
      ) : null}
      {modal === "interview" && selected ? (
        <StageTransitionConfirmModal
          candidate={selected}
          jobId={jobId}
          onCancel={() => setModal(null)}
          onCompleted={() => finishAction(copy.actionMessages.movedToInterview)}
        />
      ) : null}
      {modal === "reject" && selected ? (
        <RejectCandidateModal
          candidate={selected}
          jobId={jobId}
          onCancel={() => setModal(null)}
          onCompleted={() =>
            finishAction(copy.actionMessages.candidateRejected)
          }
        />
      ) : null}
    </section>
  );
}
