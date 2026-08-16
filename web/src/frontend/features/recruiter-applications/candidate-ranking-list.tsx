"use client";

import { type FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
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

function displayFilterLabel(label: string) {
  return label.replaceAll("â€“", "–").replaceAll("â€”", "—");
}

function Pagination({
  pageIndex,
  pageSize,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onPageSize,
}: {
  pageIndex: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPageSize: (value: number) => void;
}) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  return (
    <footer className="ranking-pagination">
      <span>
        Showing {start}–{end} of {total} candidates
      </span>
      <label>
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
        </select>
      </label>
      <div className="ranking-pager" aria-label="Pagination">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <span aria-current="page">Page {pageIndex + 1}</span>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
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
            <RankingSkeleton className="ranking-skeleton--icon" />
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
  const skills = row.skills.slice(0, 3);
  const extraSkills = Math.max(0, row.skills.length - skills.length);
  return (
    <div
      className={`ranking-table__row${row.scoring.kind === "PROCESSING" || row.scoring.kind === "PENDING" ? "is-processing" : ""}`}
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
          {row.manuallyPrioritized ? <em>✦ Manually prioritized</em> : null}
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
        {row.experienceYears === null ? (
          <span className="ranking-muted-text">Not detected</span>
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
          <>
            {skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
            {extraSkills ? <small>+{extraSkills} more</small> : null}
          </>
        ) : (
          <span className="ranking-muted-text">Not detected</span>
        )}
      </span>
      <span
        className="ranking-table__cell ranking-score-number"
        role="cell"
        data-label="Auto match"
      >
        {formatScore(row.scoreSummary.automatic)}
      </span>
      <span
        className="ranking-table__cell ranking-score-number ranking-score-number--ai"
        role="cell"
        data-label="AI score"
      >
        {formatScore(row.scoreSummary.ai)}
      </span>
      <span
        className="ranking-table__cell ranking-final-score"
        role="cell"
        data-label="Final score"
      >
        <strong>{formatScore(row.scoreSummary.final)}</strong>
        <ScoreBadge meta={badge} compact />
      </span>
      <span
        className="ranking-table__cell ranking-applied-date"
        role="cell"
        data-label="Applied"
      >
        <CalendarDays aria-hidden="true" />
        {new Date(row.submittedAt).toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
    </div>
  );
}

export function CandidateRankingList({
  jobId,
  jobTitle,
  onBack,
}: {
  jobId: string;
  jobTitle: string;
  onBack?: () => void;
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
  const activeFilterCount = [
    query.search,
    query.minScore !== undefined || query.maxScore !== undefined,
    query.skill,
    query.minExperience !== undefined,
    query.stage !== "ACTIVE_PIPELINE",
    query.scoringStatus !== "ALL",
  ].filter(Boolean).length;
  const activeFilter = activeFilterCount > 0;
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
  const removeFilter = (token: string) => {
    if (token === "search") {
      setSearchDraft("");
      updateQuery({ search: undefined });
    }
    if (token === "score")
      updateQuery({ minScore: undefined, maxScore: undefined });
    if (token === "skill") {
      setSkillDraft("");
      updateQuery({ skill: undefined });
    }
    if (token === "experience") updateQuery({ minExperience: undefined });
    if (token === "stage") updateQuery({ stage: "ACTIVE_PIPELINE" });
    if (token === "scoringStatus") updateQuery({ scoringStatus: "ALL" });
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
  const resultCount = activeFilter
    ? (page?.filteredCandidates ?? 0)
    : (page?.totalCandidates ?? 0);

  return (
    <section
      className="ai-ranking-workspace"
      aria-labelledby="candidate-ranking-title"
    >
      <header className="ai-ranking-page-header">
        <div>
          {onBack ? (
            <button
              type="button"
              className="ranking-back-button"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" /> Back to campaigns
            </button>
          ) : null}
          <p className="recruiter-eyebrow">Candidate intelligence</p>
          <h1 id="candidate-ranking-title">{jobTitle} candidates</h1>
          <p>
            Review every score with its evidence before making a human decision.
          </p>
        </div>
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
              icon={Users}
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
            <label className="ranking-filter-field ranking-search-field">
              <span>Search</span>
              <span className="ranking-input-wrap">
                <Search aria-hidden="true" />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Name, email, or skill"
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
              <span>Required skill</span>
              <input
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                onBlur={() =>
                  updateQuery({ skill: skillDraft.trim() || undefined })
                }
                placeholder="e.g. React"
              />
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
            <label className="ranking-filter-field">
              <span>Recruitment status</span>
              <select
                value={query.stage}
                onChange={(event) =>
                  updateQuery({
                    stage: event.target.value as RankedCandidateQuery["stage"],
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
            <label className="ranking-filter-field ranking-sort-field">
              <span>Sort by</span>
              <span className="ranking-input-wrap">
                <SlidersHorizontal aria-hidden="true" />
                <select
                  value={query.sort}
                  onChange={(event) =>
                    updateQuery({
                      sort: event.target.value as RankedCandidateQuery["sort"],
                    })
                  }
                >
                  <option value="FINAL_SCORE">Highest final score</option>
                  <option value="MANUAL_PRIORITY">Manual priority</option>
                  <option value="SUBMITTED_AT">Most recently applied</option>
                </select>
              </span>
            </label>
          </form>

          <div className="ranking-results-toolbar">
            <div>
              <strong>
                {resultCount.toLocaleString("en-US")} candidates match the
                filters
              </strong>
              <span>
                {activeFilter
                  ? `${page?.totalCandidates?.toLocaleString("en-US") ?? 0} candidates in this campaign · ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                  : "Active pipeline · Rejected candidates are hidden by default"}
              </span>
            </div>
            {activeFilter ? (
              <button
                type="button"
                className="ai-ranking-clear-button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {page?.activeFilters.length ? (
            <div className="ranking-filter-chips" aria-label="Active filters">
              {page.activeFilters.map((filter) => (
                <button
                  type="button"
                  key={filter.code}
                  onClick={() => removeFilter(filter.removeToken)}
                >
                  {displayFilterLabel(filter.label)} <X aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
          {query.minScore !== undefined && page?.processingExclusionLabel ? (
            <p className="ranking-filter-note" role="status">
              <Info aria-hidden="true" /> {page.processingExclusionLabel}
            </p>
          ) : null}
          {page?.defaultRejectedExclusionLabel && !activeFilter ? (
            <p className="ranking-default-stage-note" role="status">
              {page.defaultRejectedExclusionLabel}
            </p>
          ) : null}

          <div
            className="ai-ranking-human-banner ranking-trust-banner"
            role="note"
          >
            <Info aria-hidden="true" />
            <span>
              <strong>Scores support decision-making only.</strong> The
              recruiter makes the final decision. Review the evidence and record
              a reason for overrides or stage changes.
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
                {activeFilter
                  ? "No candidates match these filters"
                  : "No candidates have applied yet"}
              </h2>
              <p>
                {activeFilter
                  ? "Try adjusting your score range or another filter."
                  : "Candidates will appear here after they submit an application."}
              </p>
              {activeFilter ? (
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
                    "AI score",
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
