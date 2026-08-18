"use client";

import type { ApplicationStage, PipelineStageCount, PipelineStagePage } from "@/shared/contracts/applications";
import { useDroppable } from "@dnd-kit/core";
import { RecruitmentPipelineCard } from "./recruitment-pipeline-card";

export function RecruitmentPipelineColumn({ jobId, summary, page, loading, loadingMore, error, onLoadMore, onRetry, onChangeStage }: { jobId: string; summary: PipelineStageCount; page: PipelineStagePage | null; loading: boolean; loadingMore: boolean; error: string | null; onLoadMore: (stage: ApplicationStage) => void; onRetry: (stage: ApplicationStage) => void; onChangeStage?: Parameters<typeof RecruitmentPipelineCard>[0]["onChangeStage"] }) {
  const droppable = useDroppable({ id: summary.stage, data: { stage: summary.stage } });
  const { setNodeRef, isOver } = droppable;
  const headingId = `pipeline-${summary.stage.toLowerCase()}-heading`;
  return (
    <section ref={setNodeRef} className={`pipeline-column${isOver ? " is-drag-over" : ""}`} role="region" aria-labelledby={headingId}>
      <header><h2 id={headingId}>{summary.label}</h2><span aria-label={`${summary.count} applications`}>{summary.count}</span></header>
      {loading ? <p role="status">Loading applications…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => onRetry(summary.stage)}>Retry</button></div> : !page?.items.length ? <p>No applications in this stage.</p> : <div className="pipeline-column__cards">{page.items.map((card) => <RecruitmentPipelineCard key={card.applicationId} card={card} jobId={jobId} onChangeStage={onChangeStage} />)}</div>}
      {page?.nextCursor ? <button type="button" onClick={() => onLoadMore(summary.stage)} disabled={loadingMore}>{loadingMore ? "Loading more…" : `Load more ${summary.label} applications`}</button> : null}
    </section>
  );
}
