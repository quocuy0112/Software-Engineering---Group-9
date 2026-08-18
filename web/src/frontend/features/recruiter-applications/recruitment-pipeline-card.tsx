"use client";

import { useDraggable } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PipelineApplicationCard } from "@/shared/contracts/applications";

export function RecruitmentPipelineCard({ card, jobId, onChangeStage, dragOverlay = false }: { card: PipelineApplicationCard; jobId: string; onChangeStage?: (card: PipelineApplicationCard) => void; dragOverlay?: boolean }) {
  const draggable = useDraggable({ id: dragOverlay ? `${card.applicationId}-overlay` : card.applicationId, data: { card }, disabled: dragOverlay || card.allowedDestinations.length === 0 });
  const { setNodeRef, listeners, attributes, transform, isDragging } = draggable;
  const canDrag = !dragOverlay && card.allowedDestinations.length > 0;
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
      <strong>{card.candidate.displayName}</strong>
      <span>Submitted {new Date(card.submittedAt).toLocaleDateString()}</span>
      <span>Stage version {card.stageVersion}</span>
      {card.score ? <span>{card.score.final === null ? card.score.state.replaceAll("_", " ") : `${card.score.final}% ${card.score.band?.label ?? "score"}`}</span> : <span>Score not calculated</span>}
      <div className="pipeline-card__actions">
        {canDrag ? <button type="button" {...attributes} onPointerDown={(event) => { event.stopPropagation(); listeners?.onPointerDown?.(event); }} onKeyDown={(event) => listeners?.onKeyDown?.(event)} aria-label={`Drag ${card.candidate.displayName} to another stage`}>Drag card</button> : null}
        {card.documents.cvAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cv`} target="_blank" rel="noreferrer">Open CV</a> : null}
        {card.documents.coverLetterAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cover-letter`} target="_blank" rel="noreferrer">Cover letter</a> : null}
        {card.allowedDestinations.length > 0 && onChangeStage ? <button type="button" onClick={(event) => { event.stopPropagation(); onChangeStage(card); }}>Change Stage</button> : null}
      </div>
    </article>
  );
}
