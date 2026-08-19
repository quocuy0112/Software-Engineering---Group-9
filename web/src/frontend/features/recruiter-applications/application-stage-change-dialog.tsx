"use client";

import { useState } from "react";
import { Modal } from "@/frontend/components/ui/modal";
import {
  pipelineStageLabels,
  rejectionReasonCodeSchema,
  type ApplicationStage,
  type PipelineApplicationCard,
  type StageTransitionCommand,
} from "@/shared/contracts/applications";

const rejectionLabels: Record<string, string> = {
  REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED:
    "Required technical experience not demonstrated",
  INSUFFICIENT_EXPERIENCE: "Insufficient experience",
  REQUIRED_SKILLS_NOT_DEMONSTRATED: "Required skills not demonstrated",
  POSITION_FILLED: "Position filled",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "Application withdrawn by candidate",
  OTHER_JOB_RELATED_REASON: "Other job-related reason",
};

export function stageTransitionNeedsDialog(target: ApplicationStage) {
  return (
    target === "REJECTED" || target === "OFFER_DECLINED" || target === "HIRED"
  );
}

export function ApplicationStageChangeDialog({
  card,
  initialTarget,
  onCancel,
  onSubmit,
}: {
  card: PipelineApplicationCard;
  initialTarget?: ApplicationStage;
  onCancel: () => void;
  onSubmit: (
    target: ApplicationStage,
    extras: Omit<
      StageTransitionCommand,
      "targetStage" | "expectedStageVersion"
    >,
  ) => void;
}) {
  // The destination list is intentionally taken verbatim from the server
  // projection. The client does not recreate or narrow transition policy.
  const allowedDestinations = card.allowedDestinations;
  const [target, setTarget] = useState<ApplicationStage | "">(
    initialTarget && allowedDestinations.includes(initialTarget)
      ? initialTarget
      : "",
  );
  const [reasonCode, setReasonCode] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const consequential = target ? stageTransitionNeedsDialog(target) : false;
  const rejection = target === "REJECTED";
  const reasonRequired = rejection || target === "OFFER_DECLINED";
  const valid =
    Boolean(target) && (!reasonRequired || Boolean(reasonCode.trim()));
  const actionLabel = rejection
    ? "Confirm rejection"
    : target === "HIRED"
      ? "Confirm hiring"
      : target === "OFFER_DECLINED"
        ? "Confirm offer declined"
        : target
          ? "Confirm stage change"
          : "Change Stage";

  return (
    <Modal
      open
      title={`Change Stage for ${card.candidate.displayName}`}
      description="Choose one destination returned for this application."
      tone={rejection ? "destructive" : "standard"}
      onClose={onCancel}
    >
      <div className="pipeline-stage-form">
        <label>
          Destination stage
          <select
            data-autofocus
            value={target}
            onChange={(event) => {
              setTarget(event.target.value as ApplicationStage);
              setReasonCode("");
              setInternalNote("");
            }}
          >
            <option value="">Choose a stage</option>
            {allowedDestinations.map((stage) => (
              <option key={stage} value={stage}>
                {pipelineStageLabels[stage]}
              </option>
            ))}
          </select>
        </label>
        {rejection ? (
          <>
            <label>
              Rejection reason
              <select
                required
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              >
                <option value="">Choose a reason</option>
                {rejectionReasonCodeSchema.options.map((reason) => (
                  <option key={reason} value={reason}>
                    {rejectionLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Private recruiter note (optional)
              <textarea
                maxLength={2_000}
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
              />
              <small>Never shared with the candidate.</small>
            </label>
          </>
        ) : null}
        {target === "OFFER_DECLINED" ? (
          <label>
            Offer declined reason
            <input
              required
              maxLength={80}
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </label>
        ) : null}
        <div className="sh-modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              target &&
              onSubmit(target, {
                confirmed: consequential || undefined,
                reasonCode: reasonCode.trim() || undefined,
                internalNote: internalNote.trim() || undefined,
              })
            }
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
