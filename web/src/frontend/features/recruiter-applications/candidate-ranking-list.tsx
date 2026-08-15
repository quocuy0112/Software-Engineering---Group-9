"use client";

import { type FormEvent, useState } from "react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { useRankedCandidates, type RankedCandidateQuery } from "./use-ranked-candidates";
import { CandidateScoreDrawer } from "./candidate-score-drawer";
import { RescoreConfirmModal } from "./rescore-confirm-modal";
import { ManualPriorityModal } from "./manual-priority-modal";
import { StageTransitionConfirmModal } from "./stage-transition-confirm-modal";
import { RejectCandidateModal } from "./reject-candidate-modal";

const defaultQuery: RankedCandidateQuery = {
  sort: "FINAL_SCORE",
  stage: "ACTIVE_PIPELINE",
  scoringStatus: "ALL",
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function matchMeta(row: RankedApplicationRow) {
  if (row.scoreSummary.band) return row.scoreSummary.band;
  if (row.scoring.kind === "UNAVAILABLE") return { code: "RULE_BASED", label: "Rule-based only", iconLabel: "!" };
  if (row.scoring.kind === "PENDING") return { code: "PENDING", label: "Pending", iconLabel: String.fromCharCode(8635) };
  if (row.scoring.kind === "NOT_CALCULATED") return { code: "NOT_CALCULATED", label: "Not calculated", iconLabel: String.fromCharCode(8212) };
  return { code: "PROCESSING", label: "Processing", iconLabel: String.fromCharCode(8635) };
}

function scoreText(value: number | null) {
  return value === null ? String.fromCharCode(8212) : value.toFixed(1);
}

function Pagination({ pageIndex, pageSize, total, hasPrevious, hasNext, onPrevious, onNext, onPageSize }: { pageIndex: number; pageSize: number; total: number; hasPrevious: boolean; hasNext: boolean; onPrevious: () => void; onNext: () => void; onPageSize: (value: number) => void }) {
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  return (
    <footer className="ai-ranking-pagination">
      <span>Showing {start}-{end} of {total} candidates</span>
      <label>Rows per page <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}><option value={5}>5/page</option><option value={10}>10/page</option><option value={25}>25/page</option><option value={50}>50/page</option></select></label>
      <div className="ai-ranking-pager">
        <button type="button" onClick={onPrevious} disabled={!hasPrevious} aria-label="Previous page">&lt; <span>Previous</span></button>
        <span aria-current="page">Page {pageIndex + 1}{hasNext ? " ..." : ""}</span>
        <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Next page"><span>Next</span> &gt;</button>
      </div>
    </footer>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: string }) {
  return <article className={`ai-ranking-summary-card ai-ranking-summary-card--${tone}`}><span className="ai-ranking-summary-card__icon" aria-hidden="true">{icon}</span><div><strong>{value.toLocaleString("en-US")}</strong><span>{label}</span></div></article>;
}

export function CandidateRankingList({ jobId, jobTitle, onBack }: { jobId: string; jobTitle: string; onBack?: () => void }) {
  const [query, setQuery] = useState<RankedCandidateQuery>(defaultQuery);
  const [pageSize, setPageSize] = useState(10);
  const [searchDraft, setSearchDraft] = useState("");
  const [selected, setSelected] = useState<RankedApplicationRow | null>(null);
  const [modal, setModal] = useState<"rescore" | "priority" | "interview" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ranking = useRankedCandidates(jobId, query, pageSize);
  const page = ranking.page;
  const activeFilter = query.minScore !== undefined || query.maxScore !== undefined || Boolean(query.search || query.skill || query.minExperience !== undefined || query.stage !== "ACTIVE_PIPELINE" || query.scoringStatus !== "ALL");
  const updateQuery = (patch: Partial<RankedCandidateQuery>) => setQuery((current) => ({ ...current, ...patch }));
  const submitSearch = (event: FormEvent) => { event.preventDefault(); updateQuery({ search: searchDraft.trim() || undefined }); };
  const clearFilters = () => { setSearchDraft(""); setQuery(defaultQuery); };
  const removeFilter = (token: string) => {
    if (token === "search") setSearchDraft("");
    if (token === "score") updateQuery({ minScore: undefined, maxScore: undefined });
    if (token === "skill") updateQuery({ skill: undefined });
    if (token === "experience") updateQuery({ minExperience: undefined });
    if (token === "stage") updateQuery({ stage: "ACTIVE_PIPELINE" });
    if (token === "scoringStatus") updateQuery({ scoringStatus: "ALL" });
    if (token === "search") updateQuery({ search: undefined });
  };
  const finishAction = (nextMessage: string) => { setModal(null); setSelected(null); setMessage(nextMessage); ranking.refresh(); };
  const openRow = (row: RankedApplicationRow) => { setMessage(null); setSelected(row); };
  const setScoreRange = (range: string) => {
    if (!range) return updateQuery({ minScore: undefined, maxScore: undefined });
    const [min, max] = range.split("-").map(Number);
    updateQuery({ minScore: min, maxScore: max });
  };

  return (
    <section className="ai-ranking-workspace" aria-labelledby="candidate-ranking-title">
      <header className="ai-ranking-page-header">
        <div>
          {onBack ? <button type="button" className="ai-ranking-back-button" onClick={onBack}>&lt;- Back to job postings</button> : null}
          <p className="recruiter-eyebrow">Automatic matching - AI ranking</p>
          <h1 id="candidate-ranking-title">Candidate ranking</h1>
          <p>{jobTitle} - Review every score with its evidence before making a decision.</p>
        </div>
        <button type="button" className="ai-ranking-button ai-ranking-button--primary" onClick={() => setModal("rescore")} disabled={Boolean(page?.rescoreInProgress)}>
          {String.fromCharCode(8635)} {page?.rescoreInProgress ? "Rescoring..." : "Rescore candidates"}
        </button>
      </header>
      {message ? <div className="ai-ranking-toast" role="status"><span>{String.fromCharCode(10003)} {message}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message">&times;</button></div> : null}
      {page?.rescoreInProgress ? <div className="ai-ranking-progress-banner" role="status"><span aria-hidden="true">{String.fromCharCode(8635)}</span><strong>Rescoring in progress</strong> - results will update automatically. Current scores remain visible until replacements are ready.</div> : null}
      <div className="ai-ranking-human-banner" role="note"><span aria-hidden="true">{String.fromCharCode(8505)}</span><div><strong>Scores support decision-making only.</strong><span>The recruiter makes the final decision. Review the evidence and record a reason for overrides or stage changes.</span></div></div>
      <div className="ai-ranking-summary-grid">
        <SummaryCard icon="●" label="Total candidates" value={page?.summary.total ?? 0} tone="total" />
        <SummaryCard icon={String.fromCharCode(10003)} label="Strong match" value={page?.summary.strong ?? 0} tone="strong" />
        <SummaryCard icon="!" label="Review needed" value={page?.summary.review ?? 0} tone="review" />
        <SummaryCard icon={String.fromCharCode(10005)} label="Low match" value={page?.summary.low ?? 0} tone="low" />
        <SummaryCard icon={String.fromCharCode(8635)} label="Processing" value={page?.summary.processing ?? 0} tone="processing" />
      </div>
      <form className="ai-ranking-filter-bar" onSubmit={submitSearch}>
        <label className="ai-ranking-search-field"><span className="sr-only">Search candidates</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, email, or skill" /><button type="submit">Search</button></label>
        <label><span>Total score</span><select value={query.minScore === undefined ? "" : `${query.minScore}-${query.maxScore ?? 100}`} onChange={(event) => setScoreRange(event.target.value)}><option value="">Any score</option><option value="80-100">80-100</option><option value="60-79.99">60-79.99</option><option value="0-59.99">0-59.99</option></select></label>
        <label><span>Required skill</span><input value={query.skill ?? ""} onChange={(event) => updateQuery({ skill: event.target.value.trim() || undefined })} placeholder="e.g. React" /></label>
        <label><span>Experience</span><select value={query.minExperience === undefined ? "" : query.minExperience} onChange={(event) => updateQuery({ minExperience: event.target.value ? Number(event.target.value) : undefined })}><option value="">Any experience</option><option value="1">1+ years</option><option value="3">3+ years</option><option value="5">5+ years</option><option value="8">8+ years</option></select></label>
        <label><span>Recruitment status</span><select value={query.stage} onChange={(event) => updateQuery({ stage: event.target.value as RankedCandidateQuery["stage"] })}><option value="ACTIVE_PIPELINE">Active pipeline</option><option value="ALL">All statuses</option><option value="APPLIED">New</option><option value="VIEWED">Screened</option><option value="SHORTLISTED">Under review</option><option value="WAITLISTED">Needs details</option><option value="INTERVIEWING">Interviewing</option><option value="REJECTED">Rejected</option></select></label>
        <label><span>Scoring status</span><select value={query.scoringStatus} onChange={(event) => updateQuery({ scoringStatus: event.target.value as RankedCandidateQuery["scoringStatus"] })}><option value="ALL">All scoring states</option><option value="PROCESSING">Processing</option><option value="SCORED">Scored</option><option value="UNAVAILABLE">AI unavailable</option><option value="NOT_CALCULATED">Not calculated</option></select></label>
        <label className="ai-ranking-sort-field"><span>Sort</span><select value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as RankedCandidateQuery["sort"] })}><option value="FINAL_SCORE">Highest final score</option><option value="MANUAL_PRIORITY">Manual priority</option><option value="SUBMITTED_AT">Most recently applied</option></select></label>
      </form>
      <div className="ai-ranking-results-toolbar"><div><strong>{activeFilter ? `Showing ${page?.filteredCandidates ?? 0} of ${page?.totalCandidates ?? 0} candidates` : `${page?.totalCandidates ?? 0} candidates`}</strong>{activeFilter ? <span>Active filters are applied to this view.</span> : null}</div>{activeFilter ? <button type="button" className="ai-ranking-clear-button" onClick={clearFilters}>Clear filters</button> : null}</div>
      {page?.activeFilters.length ? <div className="ai-ranking-filter-chips" aria-label="Active filters">{page.activeFilters.map((filter) => <button type="button" key={filter.code} onClick={() => removeFilter(filter.removeToken)}>{filter.label} <span aria-hidden="true">&times;</span></button>)}</div> : null}
      {query.minScore !== undefined && page?.processingExclusionLabel ? <p className="ai-ranking-filter-note" role="status">{String.fromCharCode(8505)} {page.processingExclusionLabel}</p> : null}
      {!activeFilter && page?.defaultRejectedExclusionLabel ? <p className="ai-ranking-default-stage-note" role="status">{page.defaultRejectedExclusionLabel}</p> : null}
      {ranking.error ? <div className="ai-ranking-empty-state" role="alert"><h2>Candidate ranking could not be loaded.</h2><p>{ranking.error}</p><button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={ranking.retry}>Retry</button></div> : ranking.loading && !page ? <div className="ai-ranking-empty-state" role="status"><span className="ai-ranking-spinner" aria-hidden="true">{String.fromCharCode(8635)}</span><h2>Loading candidate ranking...</h2><p>The current filters and score order are being prepared.</p></div> : page && page.items.length === 0 ? <div className="ai-ranking-empty-state"><span className="ai-ranking-empty-state__icon" aria-hidden="true">⌕</span><h2>{activeFilter ? "No candidates match the selected filters." : "No candidates have applied yet."}</h2><p>{activeFilter ? "Try adjusting your score range or another filter." : "Candidates will appear here after they submit an application."}</p>{activeFilter ? <button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={clearFilters}>Clear filters</button> : null}</div> : <div className="ai-ranking-table-shell"><div className="ai-ranking-table" role="table" aria-label="Candidate ranking list"><div className="ai-ranking-table__head" role="row"><span role="columnheader">Rank</span><span role="columnheader">Candidate</span><span role="columnheader">Status</span><span role="columnheader">Experience</span><span role="columnheader">Key skills</span><span role="columnheader">Auto match</span><span role="columnheader">AI</span><span role="columnheader">Final score</span></div>{page?.items.map((row, index) => { const badge = matchMeta(row); return <div key={row.applicationId} className="ai-ranking-table__row" role="row" tabIndex={0} onClick={() => openRow(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openRow(row); } }}><span className="ai-ranking-rank" role="cell">{index + 1 + ranking.pageIndex * pageSize}</span><span className="ai-ranking-candidate-cell" role="cell"><span className="ai-ranking-avatar" aria-hidden="true">{row.candidate.displayName.slice(0, 1)}</span><span><strong>{row.candidate.displayName}</strong><small>{row.candidate.verifiedEmail}</small>{row.manuallyPrioritized ? <em>{String.fromCharCode(9734)} Manually prioritized</em> : null}</span></span><span role="cell"><span className="ai-ranking-status-pill">{statusLabel(row.stage)}</span></span><span role="cell">{row.experienceYears === null ? "Not detected" : `${row.experienceYears} yrs`}</span><span className="ai-ranking-skills-cell" role="cell">{row.skills.length ? row.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>) : <small>Not detected</small>}</span><span role="cell" className="ai-ranking-number-cell">{scoreText(row.scoreSummary.automatic)}</span><span role="cell" className="ai-ranking-number-cell">{scoreText(row.scoreSummary.ai)}</span><span role="cell" className="ai-ranking-final-cell">{row.scoreSummary.final === null ? <><strong>{String.fromCharCode(8212)}</strong><span className={`ai-ranking-match-badge ai-ranking-match-badge--${badge.code.toLowerCase()}`}><span aria-hidden="true">{badge.iconLabel}</span>{badge.label}</span></> : <><strong>{row.scoreSummary.final.toFixed(1)}</strong><span className={`ai-ranking-match-badge ai-ranking-match-badge--${badge.code.toLowerCase()}`}><span aria-hidden="true">{badge.iconLabel}</span>{badge.label}</span></>}</span></div>; })}</div></div>}
      {page && page.items.length ? <Pagination pageIndex={ranking.pageIndex} pageSize={pageSize} total={activeFilter ? page.filteredCandidates : page.totalCandidates} hasPrevious={ranking.hasPrevious} hasNext={ranking.hasNext} onPrevious={ranking.previous} onNext={ranking.next} onPageSize={setPageSize} /> : null}
      {selected ? <CandidateScoreDrawer jobId={jobId} jobTitle={jobTitle} candidate={selected} onClose={() => setSelected(null)} onSetPriority={() => setModal("priority")} onMoveToInterview={() => setModal("interview")} onReject={() => setModal("reject")} /> : null}
      {modal === "rescore" ? <RescoreConfirmModal jobId={jobId} jobTitle={jobTitle} totalCount={page?.totalCandidates ?? 0} onCancel={() => setModal(null)} onCompleted={() => finishAction("Background rescore started. Existing scores remain visible while results update.")} /> : null}
      {modal === "priority" && selected ? <ManualPriorityModal candidate={selected} onCancel={() => setModal(null)} onCompleted={() => finishAction("Manual priority saved and will be preserved during rescoring.")} /> : null}
      {modal === "interview" && selected ? <StageTransitionConfirmModal candidate={selected} onCancel={() => setModal(null)} onCompleted={() => finishAction("Candidate moved to Interviewing. The stage history and notification were recorded.")} /> : null}
      {modal === "reject" && selected ? <RejectCandidateModal candidate={selected} onCancel={() => setModal(null)} onCompleted={() => finishAction("Candidate rejected. The reason was stored in stage history.")} /> : null}
    </section>
  );
}
