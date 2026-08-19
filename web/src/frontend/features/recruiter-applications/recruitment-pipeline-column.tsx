"use client";

import type { ApplicationStage, PipelineStageCount, PipelineStagePage } from "@/shared/contracts/applications";
import { useDroppable } from "@dnd-kit/core";
import { Inbox, LockKeyhole } from "lucide-react";
import { RecruitmentPipelineCard } from "./recruitment-pipeline-card";

export function RecruitmentPipelineColumn({ jobId, summary, page, loading, loadingMore, error, onLoadMore, onRetry, onChangeStage, onViewAssessment }: { jobId: string; summary: PipelineStageCount; page: PipelineStagePage | null; loading: boolean; loadingMore: boolean; error: string | null; onLoadMore: (stage: ApplicationStage) => void; onRetry: (stage: ApplicationStage) => void; onChangeStage?: Parameters<typeof RecruitmentPipelineCard>[0]["onChangeStage"]; onViewAssessment?: Parameters<typeof RecruitmentPipelineCard>[0]["onViewAssessment"] }) {
  const locked = ["OFFERED", "HIRED", "OFFER_DECLINED"].includes(summary.stage);
  const droppable = useDroppable({ id: summary.stage, data: { stage: summary.stage }, disabled: locked });
  const { setNodeRef, isOver } = droppable;
  const headingId = `pipeline-${summary.stage.toLowerCase()}-heading`;
  return (
    <section ref={setNodeRef} className={`pipeline-column${isOver ? " is-drag-over" : ""}${locked ? " is-locked" : ""}`} role="region" aria-labelledby={headingId} aria-disabled={locked || undefined}>
      <header>
        <h2 id={headingId} aria-describedby={`${headingId}-count`}>{summary.label}</h2>
        <span id={`${headingId}-count`} aria-label={`${summary.count} candidates`}>({summary.count})</span>
        {locked ? <LockKeyhole aria-label="Recruiter drag locked" /> : null}
      </header>
      {loading ? <p role="status">Loading applications…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => onRetry(summary.stage)}>Retry</button></div> : !page?.items.length ? <div className="pipeline-column__empty"><Inbox aria-hidden="true" /><span aria-label="No applications in this stage.">No candidates yet.</span></div> : <div className="pipeline-column__cards">{page.items.map((card) => <RecruitmentPipelineCard key={card.applicationId} card={card} jobId={jobId} onChangeStage={onChangeStage} onViewAssessment={onViewAssessment} />)}</div>}
      {page?.nextCursor ? <button type="button" onClick={() => onLoadMore(summary.stage)} disabled={loadingMore}>{loadingMore ? "Loading more…" : `Load more ${summary.label} applications`}</button> : null}
    </section>
  );
}
