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

const defaultQuery: RankedCandidateQuery = {
  sort: "FINAL_SCORE",
  stage: "ACTIVE_PIPELINE",
  scoringStatus: "ALL",
};

function formatLastScoredAt(value: string | null | undefined) {
  if (!value) return "Not yet scored";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return `${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}, ${date.toLocaleDateString("en-GB", {
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
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="ranking-pagination">
      <span>
        Showing {start}–{end} of {total} candidates
      </span>
      <label className="ranking-pagination__page-size">
        <span className="sr-only">Candidates per page</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
        </select>
      </label>
      <nav className="ranking-pager" aria-label="Pagination">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          aria-label="Previous page"
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
              aria-label={`Page ${item + 1}`}
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
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}

function RankingLoadingState() {
  return (
    <div
      className="ranking-loading-state"
      role="status"
      aria-label="Loading candidate ranking"
    >
      <div className="ranking-loading-state__stats">
        {(
          [
            "Total candidates",
            "Strong match",
            "Review needed",
            "Low match",
            "Processing",
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
        <LoaderCircle aria-hidden="true" className="is-spinning" /> Preparing
        the current filters and score order…
      </span>
    </div>
  );
}

function RankingErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="ranking-empty-state" role="alert">
      <CircleX aria-hidden="true" />
      <h2>Candidate ranking could not be loaded</h2>
      <p>{message}</p>
      <button
        type="button"
        className="ai-ranking-button ai-ranking-button--secondary"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function CandidateRow({
  row,
  rank,
  onOpen,
}: {
  row: RankedApplicationRow;
  rank: number;
  onOpen: () => void;
}) {
  const badge = scoreBadgeForRow(row);
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
        data-label="Rank"
      >
        {rank}
      </span>
      <span
        className="ranking-table__cell ranking-candidate-cell"
        role="cell"
        data-label="Candidate"
      >
        <span className="ranking-avatar" aria-hidden="true">
          {row.candidate.displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="ranking-candidate-cell__copy">
          <strong>{row.candidate.displayName}</strong>
          <small>{row.candidate.verifiedEmail}</small>
          {row.manuallyPrioritized ? (
            <span className="ranking-manual-priority">
              <Plus aria-hidden="true" /> Manually prioritized
            </span>
          ) : null}
        </span>
      </span>
      <span className="ranking-table__cell" role="cell" data-label="Status">
        <span className="ranking-status-pill">{statusLabel(row.stage)}</span>
      </span>
      <span
        className="ranking-table__cell ranking-table__experience"
        role="cell"
        data-label="Experience"
      >
        {isProcessing || row.experienceYears === null ? (
          <span className="ranking-muted-text">{"\u2014"}</span>
        ) : (
          `${row.experienceYears} ${row.experienceYears === 1 ? "year" : "years"}`
        )}
      </span>
      <span
        className="ranking-table__cell ranking-skills-cell"
        role="cell"
        data-label="Key skills"
      >
        {skills.length ? (
          <span
            className="ranking-skills-text"
            title={skillsLabel}
            aria-label={skillsLabel}
          >
            {skills.join(", ")}
            {extraSkills ? ` +${extraSkills} more` : ""}
          </span>
        ) : (
          <span className="ranking-muted-text">
            {row.scoring.kind === "PROCESSING" || row.scoring.kind === "PENDING"
              ? "Extracting skills"
              : "Not detected"}
          </span>
        )}
      </span>
      <span
        className="ranking-table__cell ranking-score-number"
        role="cell"
        data-label="Auto match"
      >
        {isProcessing ? "\u2014" : formatTableScore(row.scoreSummary.automatic)}
      </span>
      <span
        className="ranking-table__cell ranking-score-number ranking-score-number--ai"
        role="cell"
        data-label="AI"
      >
        {isProcessing ? "\u2014" : formatTableScore(row.scoreSummary.ai)}
      </span>
      <span
        className="ranking-table__cell ranking-final-score"
        role="cell"
        data-label="Final score"
      >
        <strong>
          {isProcessing ? "\u2014" : formatScore(row.scoreSummary.final)}
        </strong>
        <ScoreBadge meta={badge} compact />
      </span>
      <span
        className="ranking-table__cell ranking-applied-date"
        role="cell"
        data-label="Applied"
      >
        <time dateTime={row.submittedAt}>
          {new Date(row.submittedAt).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
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
}: {
  jobId: string;
  jobTitle: string;
  onBack?: () => void;
  backHref?: string;
}) {
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
  const ranking = useRankedCandidates(jobId, query, pageSize);
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
          <nav className="ranking-breadcrumbs" aria-label="Breadcrumb">
            <Link href={recruiterRoutes.jobPostings}>Recruitment</Link>
            <span aria-hidden="true">/</span>
            <Link href={recruiterRoutes.candidates}>Campaigns</Link>
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
            <span aria-current="page">Candidates</span>
          </nav>
          <h1 id="candidate-ranking-title">
            Candidates {"\u2013"} {jobTitle}
          </h1>
          <p className="ranking-last-scored">
            {page?.totalCandidates?.toLocaleString("en-US") ?? "\u2014"}{" "}
            applications {"\u00b7"} Last scored:{" "}
            {formatLastScoredAt(page?.lastScoredAt)}
          </p>
        </div>
        <div className="ranking-header-actions">
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
            {rankingRefreshing ? "Refreshing…" : "Refresh"}
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
            {page?.rescoreInProgress ? "Rescoring…" : "Rescore candidates"}
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
            aria-label="Dismiss message"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {page?.rescoreInProgress ? (
        <div className="ranking-progress-banner" role="status">
          <RefreshCw aria-hidden="true" className="is-spinning" />
          <span>
            <strong>Rescoring in progress</strong> Results will update
            automatically. Current scores stay visible until replacements are
            ready.
          </span>
        </div>
      ) : null}

      {!page ? (
        ranking.error ? (
          <RankingErrorState message={ranking.error} onRetry={ranking.retry} />
        ) : (
          <RankingLoadingState />
        )
      ) : (
        <>
          <div className="ranking-summary-grid">
            <StatCard
              icon={CircleDot}
              label="Total candidates"
              value={page?.summary.total}
              tone="blue"
            />
            <StatCard
              icon={CheckCircle2}
              label="Strong match"
              value={page?.summary.strong}
              tone="green"
            />
            <StatCard
              icon={AlertCircle}
              label="Review needed"
              value={page?.summary.review}
              tone="amber"
            />
            <StatCard
              icon={CircleX}
              label="Low match"
              value={page?.summary.low}
              tone="red"
            />
            <StatCard
              icon={LoaderCircle}
              label="Processing"
              value={page?.summary.processing}
              tone="purple"
            />
          </div>

          <form className="ranking-filter-bar" onSubmit={submitSearch}>
            <div className="ranking-filter-row ranking-filter-row--primary">
              <label className="ranking-filter-field ranking-search-field">
                <span>Search</span>
                <span className="ranking-input-wrap">
                  <Search aria-hidden="true" />
                  <input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Search by name, email, or skill"
                  />
                </span>
              </label>
              <label className="ranking-filter-field">
                <span>Total score</span>
                <select
                  aria-label="Total score"
                  value={
                    query.minScore === undefined
                      ? ""
                      : `${query.minScore}-${query.maxScore ?? 100}`
                  }
                  onChange={(event) => setScoreRange(event.target.value)}
                >
                  <option value="">Any score</option>
                  <option value="80-100">80–100</option>
                  <option value="60-79.99">60–79.99</option>
                  <option value="0-59.99">0–59.99</option>
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>Required skills</span>
                <select
                  aria-label="Required skills"
                  value={skillDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSkillDraft(value);
                    updateQuery({ skill: value || undefined });
                  }}
                >
                  <option value="">Any required skill</option>
                  {skillOptions.map((skill) => (
                    <option value={skill} key={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>Experience</span>
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
                  <option value="">Any experience</option>
                  <option value="1">1+ years</option>
                  <option value="3">3+ years</option>
                  <option value="5">5+ years</option>
                  <option value="8">8+ years</option>
                </select>
              </label>
              <button
                type="button"
                className="ranking-clear-filters"
                onClick={clearFilters}
              >
                <X aria-hidden="true" /> Clear filters
              </button>
            </div>
            <div className="ranking-filter-row ranking-filter-row--secondary">
              <label className="ranking-filter-field">
                <span>Recruitment status</span>
                <select
                  value={query.stage}
                  onChange={(event) =>
                    updateQuery({
                      stage: event.target
                        .value as RankedCandidateQuery["stage"],
                    })
                  }
                >
                  <option value="ACTIVE_PIPELINE">Active pipeline</option>
                  <option value="ALL">All statuses</option>
                  <option value="APPLIED">New</option>
                  <option value="VIEWED">Screened</option>
                  <option value="SHORTLISTED">Under review</option>
                  <option value="WAITLISTED">Needs details</option>
                  <option value="INTERVIEWING">Interviewing</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
              <label className="ranking-filter-field">
                <span>Scoring status</span>
                <select
                  value={query.scoringStatus}
                  onChange={(event) =>
                    updateQuery({
                      scoringStatus: event.target
                        .value as RankedCandidateQuery["scoringStatus"],
                    })
                  }
                >
                  <option value="ALL">All scoring states</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SCORED">Scored</option>
                  <option value="UNAVAILABLE">AI unavailable</option>
                  <option value="NOT_CALCULATED">Not calculated</option>
                </select>
              </label>
              <p className="ranking-filter-results" role="status">
                {resultCount.toLocaleString("en-US")} candidates match the
                filters
              </p>
              <label className="ranking-filter-field ranking-sort-field">
                <span>Sort by</span>
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
                    <option value="FINAL_SCORE">Highest final score</option>
                    <option value="MANUAL_PRIORITY">Manual priority</option>
                    <option value="SUBMITTED_AT">Most recently applied</option>
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
              <strong>Scores support decision-making only.</strong> The
              recruiter makes the final decision.
            </span>
          </div>

          {ranking.error ? (
            <RankingErrorState
              message={ranking.error}
              onRetry={ranking.retry}
            />
          ) : page && page.items.length === 0 ? (
            <div className="ranking-empty-state">
              <EmptyCandidatesIllustration />
              <h2>
                {resultCount < (page?.totalCandidates ?? 0)
                  ? "No candidates match these filters"
                  : "No candidates have applied yet"}
              </h2>
              <p>
                {resultCount < (page?.totalCandidates ?? 0)
                  ? "Try adjusting your score range or another filter."
                  : "Candidates will appear here after they submit an application."}
              </p>
              {resultCount < (page?.totalCandidates ?? 0) ? (
                <button
                  type="button"
                  className="ai-ranking-button ai-ranking-button--secondary"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : page ? (
            <div className="ranking-table-shell" aria-busy={ranking.loading}>
              <div
                className="ranking-table"
                role="table"
                aria-label="Candidate ranking list"
              >
                <div className="ranking-table__head" role="row">
                  {[
                    "Rank",
                    "Candidate",
                    "Status",
                    "Experience",
                    "Key skills",
                    "Auto match",
                    "AI",
                    "Final score",
                    "Applied",
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
          onMoveToInterview={() => setModal("interview")}
          onReject={() => setModal("reject")}
          onScoringChanged={ranking.refresh}
        />
      ) : null}
      {modal === "rescore" ? (
        <RescoreConfirmModal
          jobId={jobId}
          jobTitle={jobTitle}
          totalCount={page?.totalCandidates ?? 0}
          onCancel={() => setModal(null)}
          onCompleted={() =>
            finishAction(
              "Background rescore started. Existing scores remain visible while results update.",
            )
          }
        />
      ) : null}
      {modal === "priority" && selected ? (
        <ManualPriorityModal
          candidate={selected}
          suggestedRank={selectedRank ?? undefined}
          onCancel={() => setModal(null)}
          onCompleted={() =>
            finishAction(
              "Manual priority saved and will be preserved during rescoring.",
            )
          }
        />
      ) : null}
      {modal === "interview" && selected ? (
        <StageTransitionConfirmModal
          candidate={selected}
          onCancel={() => setModal(null)}
          onCompleted={() =>
            finishAction(
              "Candidate moved to Interviewing. The stage history and notification were recorded.",
            )
          }
        />
      ) : null}
      {modal === "reject" && selected ? (
        <RejectCandidateModal
          candidate={selected}
          onCancel={() => setModal(null)}
          onCompleted={() =>
            finishAction(
              "Candidate rejected. The reason was stored in stage history.",
            )
          }
        />
      ) : null}
    </section>
  );
}
