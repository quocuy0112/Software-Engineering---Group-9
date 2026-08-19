"use client";

import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, GripVertical, LockKeyhole } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { ProgressRing } from "@/frontend/components/ui/progress-ring";
import {
  isTerminalPipelineStage,
  pipelineStageLabels,
  type ApplicationStage,
  type PipelineApplicationCard,
} from "@/shared/contracts/applications";
import {
  pipelineScoreForCard,
  pipelineTierForCard,
} from "./recruitment-pipeline-ui";

const quickActionLabels: Partial<Record<ApplicationStage, string>> = {
  SHORTLISTED: "Move to shortlist",
  INTERVIEWING: "Move to interview",
  OFFERED: "Send offer",
  REJECTED: "Reject",
  WAITLISTED: "Waitlist",
};

const collapsibleStages = new Set<ApplicationStage>([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
]);

const lockedStages = new Set<ApplicationStage>([
  "OFFERED",
  "WAITLISTED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
]);

const tierLabels = {
  strong: "Strong match",
  review: "Review needed",
  low: "Low match",
  pending: "Not yet scored",
} as const;

function stopInteractiveEvent(event: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
}) {
  if (!(event.target instanceof Element)) return false;
  const interactive = event.target.closest(
    "a, button, input, select, textarea, [role='button'], [contenteditable='true']",
  );
  return Boolean(interactive && interactive !== event.currentTarget);
}
export function RecruitmentPipelineCard({
  card,
  jobId,
  onChangeStage,
  onViewAssessment,
  dragOverlay = false,
}: {
  card: PipelineApplicationCard;
  jobId: string;
  onChangeStage?: (
    card: PipelineApplicationCard,
    targetStage?: ApplicationStage,
  ) => void;
  onViewAssessment?: (card: PipelineApplicationCard) => void;
  dragOverlay?: boolean;
}) {
  const terminal = isTerminalPipelineStage(card.stage);
  const locked = lockedStages.has(card.stage);
  // The server projection is authoritative. A missing dragDestinations value
  // is treated as no drag permission instead of widening the policy on the FE.
  const dragDestinations = terminal ? [] : (card.dragDestinations ?? []);
  const allowedDestinations = terminal ? [] : card.allowedDestinations;
  const canDrag = !dragOverlay && dragDestinations.length > 0 && !locked;
  const collapsible = !dragOverlay && collapsibleStages.has(card.stage);
  const [expanded, setExpanded] = useState(!collapsible);
  const draggable = useDraggable({
    id: dragOverlay ? `${card.applicationId}-overlay` : card.applicationId,
    data: { card, dragDestinations },
    disabled: !canDrag,
  });
  const { setNodeRef, listeners, attributes, transform, isDragging } =
    draggable;
  const score = pipelineScoreForCard(card);
  const tier = pipelineTierForCard(card);
  const quickActions = locked
    ? []
    : allowedDestinations
        .filter((stage) => quickActionLabels[stage])
        .map((stage) => ({
          stage,
          label: quickActionLabels[stage] as string,
        }));

  const toggleExpanded = () => {
    if (collapsible) setExpanded((current) => !current);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (stopInteractiveEvent(event)) return;
    toggleExpanded();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!collapsible || stopInteractiveEvent(event)) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded();
    }
  };

  const actionPanel = (
    <div
      className="pipeline-card__actions-panel"
      data-state={expanded ? "open" : "closed"}
    >
      <div className="pipeline-card__document-actions">
        {card.documents.cvAvailable ? (
          <a
            href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cv`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Open CV
          </a>
        ) : null}
        {card.documents.coverLetterAvailable ? (
          <a
            href={`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/documents/cover-letter`}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Cover letter
          </a>
        ) : null}
      </div>
      {onViewAssessment ? (
        <button
          type="button"
          className="pipeline-card__assessment-action"
          onClick={(event) => {
            event.stopPropagation();
            onViewAssessment(card);
          }}
        >
          View AI assessment
        </button>
      ) : null}
      {quickActions.length > 0 ? (
        <div className="pipeline-card__quick-actions">
          {quickActions.map(({ stage, label }) => (
            <button
              key={stage}
              type="button"
              className={`pipeline-card__quick-action pipeline-card__quick-action--${stage === "REJECTED" ? "reject" : stage === "WAITLISTED" ? "waitlist" : "move"}`}
              onClick={(event) => {
                event.stopPropagation();
                onChangeStage?.(card, stage);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {allowedDestinations.length > 0 && onChangeStage ? (
        <button
          type="button"
          className="pipeline-card__change-stage"
          onClick={(event) => {
            event.stopPropagation();
            onChangeStage(card);
          }}
        >
          Change Stage
        </button>
      ) : null}
    </div>
  );

  return (
    <article
      ref={setNodeRef}
      className={`pipeline-card${canDrag ? "is-draggable" : ""}${isDragging ? "is-dragging" : ""}${dragOverlay ? "pipeline-card--overlay" : ""}${collapsible ? "is-collapsible" : ""}${expanded ? "is-expanded" : ""}`}
      data-application-id={dragOverlay ? undefined : card.applicationId}
      data-stage={card.stage}
      data-tier={tier}
      data-score={score ?? -1}
      data-dragging={isDragging ? "true" : undefined}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      role={collapsible ? "button" : undefined}
      tabIndex={collapsible ? 0 : -1}
      aria-expanded={collapsible ? expanded : undefined}
      onClick={collapsible ? handleCardClick : undefined}
      onKeyDown={collapsible ? handleCardKeyDown : undefined}
    >
      <div className="pipeline-card__topline">
        <div className="pipeline-card__identity">
          <strong>{card.candidate.displayName}</strong>
          {terminal ? (
            <span className="pipeline-card__status-pill">
              {pipelineStageLabels[card.stage].toUpperCase()}
            </span>
          ) : null}
        </div>
        {canDrag ? (
          <button
            type="button"
            className="pipeline-card__drag-handle"
            {...attributes}
            onPointerDown={(event) => {
              event.stopPropagation();
              listeners?.onPointerDown?.(event);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              listeners?.onKeyDown?.(event);
            }}
            aria-label={`Drag ${card.candidate.displayName} to another stage`}
            title="Drag card"
          >
            <GripVertical aria-hidden="true" />
          </button>
        ) : locked ? (
          <LockKeyhole
            className="pipeline-card__locked-icon"
            aria-label="Stage is locked"
          />
        ) : null}
      </div>
      <time dateTime={card.submittedAt}>
        Submitted{" "}
        {new Date(card.submittedAt).toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </time>
      <div className={`pipeline-card__score pipeline-card__score--${tier}`}>
        {score !== null ? (
          <ProgressRing
            percent={score}
            size={48}
            label={`Final score ${Math.round(score)} percent for ${card.candidate.displayName}`}
            caption="Final score"
          />
        ) : (
          <div
            className="pipeline-card__score-pending"
            aria-label="Final score not yet available"
          >
            <strong>&mdash;</strong>
            <span>Final score</span>
          </div>
        )}
        <div className="pipeline-card__score-meta">
          <span>Final score</span>
          <strong>{tierLabels[tier]}</strong>
        </div>
      </div>
      {collapsible ? (
        <div className="pipeline-card__hint" aria-hidden="true">
          <span>
            {expanded ? "Click to collapse" : "Click to view actions"}
          </span>
          <ChevronDown />
        </div>
      ) : null}
      {collapsible ? (expanded ? actionPanel : null) : actionPanel}
    </article>
  );
}
