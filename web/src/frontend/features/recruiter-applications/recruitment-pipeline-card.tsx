"use client";

import { useDraggable } from "@dnd-kit/core";
import type { PipelineApplicationCard } from "@/shared/contracts/applications";

export function RecruitmentPipelineCard({ card, jobId, onChangeStage, dragOverlay = false }: { card: PipelineApplicationCard; jobId: string; onChangeStage?: (card: PipelineApplicationCard) => void; dragOverlay?: boolean }) {
  const draggable = useDraggable({ id: dragOverlay ? `${card.applicationId}-overlay` : card.applicationId, data: { card }, disabled: dragOverlay || card.allowedDestinations.length === 0 });
  const { setNodeRef, listeners, attributes, transform } = draggable;
  return (
    <article ref={setNodeRef} className="pipeline-card" data-application-id={dragOverlay ? undefined : card.applicationId} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} tabIndex={-1}>
      <strong>{card.candidate.displayName}</strong>
      <span>Submitted {new Date(card.submittedAt).toLocaleDateString()}</span>
      <span>Stage version {card.stageVersion}</span>
      {card.score ? <span>{card.score.final === null ? card.score.state.replaceAll("_", " ") : `${card.score.final}% ${card.score.band?.label ?? "score"}`}</span> : <span>Score not calculated</span>}
      <div className="pipeline-card__actions">
        {!dragOverlay && card.allowedDestinations.length > 0 ? <button type="button" {...listeners} {...attributes} aria-label={`Drag ${card.candidate.displayName} to another stage`}>Drag card</button> : null}
        {card.documents.cvAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cv`} target="_blank" rel="noreferrer">Open CV</a> : null}
        {card.documents.coverLetterAvailable ? <a href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cover-letter`} target="_blank" rel="noreferrer">Cover letter</a> : null}
        {card.allowedDestinations.length > 0 && onChangeStage ? <button type="button" onClick={(event) => { event.stopPropagation(); onChangeStage(card); }}>Change Stage</button> : null}
      </div>
    </article>
  );
}
