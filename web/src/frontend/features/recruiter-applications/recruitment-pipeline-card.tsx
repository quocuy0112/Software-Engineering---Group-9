"use client";

import { useDraggable } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ProgressRing } from "@/frontend/components/ui/progress-ring";
import {
  isTerminalPipelineStage,
  pipelineStageLabels,
  type ApplicationStage,
  type PipelineApplicationCard,
} from "@/shared/contracts/applications";
import { ScoreBadgeFromLabel } from "./candidate-ranking-ui";

const quickActionLabels: Partial<Record<ApplicationStage, string>> = {
  SHORTLISTED: "Move to shortlist",
  INTERVIEWING: "Move to interview",
  OFFERED: "Send offer",
  REJECTED: "Reject",
  WAITLISTED: "Waitlist",
};

function scoreValue(card: PipelineApplicationCard) {
  return card.score?.final ?? null;
}

export function RecruitmentPipelineCard({ card, jobId, onChangeStage, onViewAssessment, dragOverlay = false }: { card: PipelineApplicationCard; jobId: string; onChangeStage?: (card: PipelineApplicationCard, targetStage?: ApplicationStage) => void; onViewAssessment?: (card: PipelineApplicationCard) => void; dragOverlay?: boolean }) {
  const terminal = isTerminalPipelineStage(card.stage);
  const dragDestinations = terminal ? [] : card.dragDestinations ?? card.allowedDestinations;
  const allowedDestinations = terminal ? [] : card.allowedDestinations;
  const draggable = useDraggable({ id: dragOverlay ? `${card.applicationId}-overlay` : card.applicationId, data: { card }, disabled: dragOverlay || dragDestinations.length === 0 });
  const { setNodeRef, listeners, attributes, transform, isDragging } = draggable;
  const canDrag = !dragOverlay && dragDestinations.length > 0;
  const handleCardPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;
    if (
      !canDrag ||
      !(target instanceof Element) ||
      target.closest(
        "a, button, input, select, textarea, [role='button'], [contenteditable='true']",
      )
    ) {
      return;
    }
    listeners?.onPointerDown?.(event);
  };
  const value = scoreValue(card);
  const scoreBand = card.score?.band ?? null;
  const quickActions = allowedDestinations
    .filter((stage) => quickActionLabels[stage])
    .map((stage) => ({ stage, label: quickActionLabels[stage] as string }));
  return (
    <article
      ref={setNodeRef}
      className={`pipeline-card${canDrag ? " is-draggable" : ""}${isDragging ? " is-dragging" : ""}${dragOverlay ? " pipeline-card--overlay" : ""}`}
      data-application-id={dragOverlay ? undefined : card.applicationId}
      data-dragging={isDragging ? "true" : undefined}
      onPointerDown={handleCardPointerDown}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      tabIndex={-1}
    >
      <div className="pipeline-card__identity">
        <strong>{card.candidate.displayName}</strong>
        <span className="application-stage-badge pipeline-card__stage-badge" data-stage={card.stage.toLowerCase().replaceAll("_", "-")}>
          <span className="application-stage-dot" aria-hidden="true" />
          {pipelineStageLabels[card.stage]}
        </span>
      </div>
      <time dateTime={card.submittedAt}>Submitted {new Date(card.submittedAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</time>
      <div className="pipeline-card__score">
        {value !== null ? <ProgressRing percent={value} size={48} label={`Final score ${Math.round(value)} percent for ${card.candidate.displayName}`} caption="Final score" /> : <span className="pipeline-card__score-unavailable">Final score unavailable</span>}
        {scoreBand ? <ScoreBadgeFromLabel code={scoreBand.code} label={scoreBand.label} compact /> : null}
      </div>
      <div className="pipeline-card__actions">
        {canDrag ? <button type="button" {...attributes} onPointerDown={(event) => { event.stopPropagation(); listeners?.onPointerDown?.(event); }} onKeyDown={(event) => listeners?.onKeyDown?.(event)} aria-label={`Drag ${card.candidate.displayName} to another stage`}>Drag card</button> : null}
        {card.documents.cvAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cv`} target="_blank" rel="noreferrer">Open CV</a> : null}
        {card.documents.coverLetterAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cover-letter`} target="_blank" rel="noreferrer">Cover letter</a> : null}
        {onViewAssessment ? <button type="button" onClick={(event) => { event.stopPropagation(); onViewAssessment(card); }}>View AI assessment</button> : null}
        {quickActions.map(({ stage, label }) => <button key={stage} type="button" onClick={(event) => { event.stopPropagation(); onChangeStage?.(card, stage); }}>{label}</button>)}
        {allowedDestinations.length > 0 && onChangeStage ? <button type="button" onClick={(event) => { event.stopPropagation(); onChangeStage(card); }}>Change Stage</button> : null}
      </div>
    </article>
  );
}
