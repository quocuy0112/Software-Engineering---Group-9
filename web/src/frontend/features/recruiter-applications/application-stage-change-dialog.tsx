"use client";

import { useState } from "react";
import {
  pipelineStageLabels,
  rejectionReasonCodeSchema,
  type ApplicationStage,
  type PipelineApplicationCard,
  type StageTransitionCommand,
} from "@/shared/contracts/applications";

const rejectionLabels: Record<string, string> = {
  REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED: "Required technical experience not demonstrated",
  INSUFFICIENT_EXPERIENCE: "Insufficient experience",
  REQUIRED_SKILLS_NOT_DEMONSTRATED: "Required skills not demonstrated",
  POSITION_FILLED: "Position filled",
  APPLICATION_WITHDRAWN_BY_CANDIDATE: "Application withdrawn by candidate",
  OTHER_JOB_RELATED_REASON: "Other job-related reason",
};

export function ApplicationStageChangeDialog({ card, initialTarget, onCancel, onSubmit }: {
  card: PipelineApplicationCard;
  initialTarget?: ApplicationStage;
  onCancel: () => void;
  onSubmit: (target: ApplicationStage, extras: Omit<StageTransitionCommand, "targetStage" | "expectedStageVersion">) => void;
}) {
  const allowedDestinations = card.allowedDestinations;
  const [target, setTarget] = useState<ApplicationStage | "">(initialTarget ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const consequential = target === "REJECTED" || target === "OFFER_DECLINED" || target === "HIRED";
  const reasonRequired = target === "REJECTED" || target === "OFFER_DECLINED";
  const valid = Boolean(target) && (!reasonRequired || Boolean(reasonCode.trim()));
  const actionLabel = target === "HIRED" ? "Confirm hiring" : target === "REJECTED" ? "Confirm rejection" : target === "OFFER_DECLINED" ? "Confirm offer declined" : "Change Stage";
  return (
    <div className="pipeline-dialog-backdrop" role="presentation">
      <div className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="stage-change-title">
        <h2 id="stage-change-title">Change Stage for {card.candidate.displayName}</h2>
        <label>Destination stage<select autoFocus value={target} onChange={(event) => { setTarget(event.target.value as ApplicationStage); setReasonCode(""); }}><option value="">Choose a stage</option>{allowedDestinations.map((stage) => <option key={stage} value={stage}>{pipelineStageLabels[stage]}</option>)}</select></label>
        {target === "REJECTED" ? <><label>Rejection reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="">Choose a reason</option>{rejectionReasonCodeSchema.options.map((reason) => <option key={reason} value={reason}>{rejectionLabels[reason]}</option>)}</select></label><label>Private recruiter note (optional)<textarea maxLength={2_000} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} /><small>Never shared with the candidate.</small></label></> : null}
        {target === "OFFER_DECLINED" ? <label>Offer declined reason<input maxLength={80} value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} /></label> : null}
        {target === "HIRED" ? <p role="note">Hiring must be explicitly confirmed by an authorized recruiter-side user. Candidate acceptance may have occurred outside SmartHire.</p> : null}
        <div><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={!valid} onClick={() => target && onSubmit(target, { confirmed: consequential || undefined, reasonCode: reasonCode.trim() || undefined, internalNote: internalNote.trim() || undefined })}>{actionLabel}</button></div>
      </div>
    </div>
  );
}
