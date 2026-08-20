"use client";

import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, GripVertical, LockKeyhole } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
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
]);

const tierLabels = {
  strong: "Strong match",
  review: "Review needed",
  low: "Low match",
  pending: "Not yet scored",
} as const;

function ScoreRing({
  score,
  tier,
  candidateName,
}: {
  score: number | null;
  tier: keyof typeof tierLabels;
  candidateName: string;
}) {
  const dashOffset =
    score === null
      ? undefined
      : 113 - (Math.max(0, Math.min(100, score)) / 100) * 113;

  return (
    <div
      className={`score-ring ring-${tier} pipeline-card__score-ring`}
      role={score === null ? undefined : "progressbar"}
      aria-label={
        score === null
          ? "Final score not yet available"
          : `Final score ${Math.round(score)} percent for ${candidateName}`
      }
      aria-valuemin={score === null ? undefined : 0}
      aria-valuemax={score === null ? undefined : 100}
      aria-valuenow={score === null ? undefined : Math.round(score)}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="track" cx="22" cy="22" r="18" />
        {score !== null ? (
          <circle
            className="value"
            cx="22"
            cy="22"
            r="18"
            strokeDasharray="113"
            strokeDashoffset={dashOffset}
          />
        ) : null}
      </svg>
      <div className="score-num">
        {score === null ? "\u2014" : `${Math.round(score)}%`}
      </div>
    </div>
  );
}

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
  const outcomeStatus = card.stage === "HIRED" || card.stage === "REJECTED";
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
  const isExpanded = !collapsible || expanded;
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
  const handleCardPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!canDrag || stopInteractiveEvent(event)) return;
    listeners?.onPointerDown?.(event);
  };

  const dragHandle = canDrag ? (
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
  ) : null;

  const actionPanel = (
    <div
      className="card-actions-panel pipeline-card__actions-panel"
      data-state={isExpanded ? "open" : "closed"}
    >
      <div className="card-actions pipeline-card__document-actions">
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
          className="assessment-btn pipeline-card__assessment-action"
          onClick={(event) => {
            event.stopPropagation();
            onViewAssessment(card);
          }}
        >
          View AI assessment
        </button>
      ) : null}
      {quickActions.length > 0 ? (
        <div className="quick-actions pipeline-card__quick-actions">
          {quickActions.map(({ stage, label }) => (
            <button
              key={stage}
              type="button"
              className={`quick-action pipeline-card__quick-action pipeline-card__quick-action--${stage === "REJECTED" ? "reject" : stage === "WAITLISTED" ? "waitlist" : "move"} ${stage === "REJECTED" ? "danger" : stage === "WAITLISTED" ? "warn" : "move"}`}
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
          className="change-stage-link pipeline-card__change-stage"
          aria-label="Change Stage"
          onClick={(event) => {
            event.stopPropagation();
            onChangeStage(card);
          }}
        >
          {"Change Stage\u2026"}
        </button>
      ) : null}
    </div>
  );

  return (
    <article
      ref={setNodeRef}
      onPointerDown={handleCardPointerDown}
      className={[
        "candidate-card",
        "pipeline-card",
        canDrag ? "is-draggable" : "",
        isDragging ? "is-dragging" : "",
        dragOverlay ? "pipeline-card--overlay" : "",
        collapsible ? "collapsible is-collapsible" : "",
        isExpanded ? "expanded is-expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-application-id={dragOverlay ? undefined : card.applicationId}
      data-stage={card.stage}
      data-tier={tier}
      data-score={score ?? -1}
      data-name={card.candidate.displayName}
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
      <div className="card-top pipeline-card__topline">
        <div className="candidate-name pipeline-card__identity">
          {card.candidate.displayName}
        </div>
        {outcomeStatus ? (
          <>
            <span
              className={`status-pill ${card.stage === "HIRED" ? "status-hired" : "status-rejected"} pipeline-card__status-pill`}
            >
              {pipelineStageLabels[card.stage].toUpperCase()}
            </span>
            {dragHandle}
          </>
        ) : canDrag ? (
          dragHandle
        ) : locked ? (
          <LockKeyhole
            className="pipeline-card__locked-icon"
            aria-label="Stage is locked"
          />
        ) : null}
      </div>
      <div className="submitted-date pipeline-card__submitted-date">
        <time dateTime={card.submittedAt}>
          Submitted{" "}
          {new Date(card.submittedAt).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </time>
      </div>
      <div
        className={`score-row pipeline-card__score pipeline-card__score--${tier}`}
      >
        <ScoreRing
          score={score}
          tier={tier}
          candidateName={card.candidate.displayName}
        />
        <div className="score-meta pipeline-card__score-meta">
          <span className="score-meta-label">Final score</span>
          <span className={`tier-badge tier-${tier}`}>
            <span className="dot" aria-hidden="true" />
            {tierLabels[tier]}
          </span>
        </div>
      </div>
      {collapsible ? (
        <div className="card-hint pipeline-card__hint" aria-hidden="true">
          <span className="hint-collapsed">{"Click to view actions"}</span>
          <span className="hint-expanded">{"Click to collapse"}</span>
          <ChevronDown aria-hidden="true" />
        </div>
      ) : null}
      {actionPanel}
    </article>
  );
}
