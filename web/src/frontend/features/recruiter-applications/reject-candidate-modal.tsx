"use client";

import { useState } from "react";
import type { RankedApplicationRow, RejectionReasonCode } from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";

const reasons: Array<[RejectionReasonCode, string]> = [
  ["REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED", "Required technical experience not demonstrated"],
  ["INSUFFICIENT_EXPERIENCE", "Insufficient experience"],
  ["REQUIRED_SKILLS_NOT_DEMONSTRATED", "Required skills not demonstrated"],
  ["POSITION_FILLED", "Position filled"],
  ["APPLICATION_WITHDRAWN_BY_CANDIDATE", "Application withdrawn by candidate"],
  ["OTHER_JOB_RELATED_REASON", "Other job-related reason"],
];

export function RejectCandidateModal({ candidate, onCancel, onCompleted }: { candidate: RankedApplicationRow; onCancel: () => void; onCompleted: () => void }) {
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | "">("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reject = async () => {
    if (!reasonCode) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/decisions/reject", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? "reject-" + Date.now() }, body: JSON.stringify({ confirmed: true, expectedStageVersion: candidate.stageVersion, reasonCode, ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}) }) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "The candidate could not be rejected.");
      onCompleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The candidate could not be rejected."); }
    finally { setSaving(false); }
  };
  return <RankingModalFrame title="Reject this candidate?" subtitle={candidate.candidate.displayName + " - Final human decision"} icon={String.fromCharCode(215)} info="AI did not make this decision. Your reason, identity and timestamp will be stored in stage history." confirmLabel={saving ? "Rejecting..." : "Reject"} onCancel={onCancel} onConfirm={() => void reject()} confirmDisabled={!reasonCode || saving} destructive><div className="ai-ranking-stage-change ai-ranking-stage-change--danger"><span>{candidate.stage.replaceAll("_", " ")}</span><strong aria-hidden="true">{String.fromCharCode(8594)}</strong><span>Rejected</span></div><label className="ai-ranking-field"><span>Rejection reason <em>Required</em></span><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as RejectionReasonCode)}><option value="">Select a standardized reason</option>{reasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><label className="ai-ranking-field"><span>Internal note <small>Optional - internal use only - never sent to the candidate</small></span><textarea value={internalNote} maxLength={2_000} onChange={(event) => setInternalNote(event.target.value)} rows={3} placeholder="Add context for the recruiting team." /></label>{error ? <p className="ai-ranking-error" role="alert">{error}</p> : null}</RankingModalFrame>;
}
