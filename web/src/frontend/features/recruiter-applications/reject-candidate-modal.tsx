"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type {
  RankedApplicationRow,
  RejectionReasonCode,
} from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationDetailCopy } from "./application-detail-copy";

export function RejectCandidateModal({
  candidate,
  jobId,
  onCancel,
  onCompleted,
}: {
  candidate: RankedApplicationRow;
  jobId?: string;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const copy = applicationDetailCopy(useWorkspaceLocale());
  const rejectCopy = copy.reject;
  const csrfProof = useCsrfProof();
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | "">("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reject = async () => {
    if (!reasonCode) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        jobId
          ? "/api/recruiter/jobs/" +
              encodeURIComponent(jobId) +
              "/applications/" +
              encodeURIComponent(candidate.applicationId) +
              "/stage"
          : "/api/recruiter/applications/" +
              encodeURIComponent(candidate.applicationId) +
              "/decisions/reject",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? "reject-" + Date.now(),
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify({
            confirmed: true,
            targetStage: "REJECTED",
            expectedStageVersion: candidate.stageVersion,
            reasonCode,
            ...(internalNote.trim()
              ? { internalNote: internalNote.trim() }
              : {}),
          }),
        },
      );
      if (!response.ok) throw new Error(rejectCopy.error);
      onCompleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : rejectCopy.error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <RankingModalFrame
      title={rejectCopy.title}
      subtitle={`${candidate.candidate.displayName} · ${rejectCopy.subtitle}`}
      icon="×"
      info={
        <>
          <AlertTriangle aria-hidden="true" />
          <span>{rejectCopy.info}</span>
        </>
      }
      confirmLabel={saving ? rejectCopy.rejecting : rejectCopy.confirm}
      cancelLabel={rejectCopy.cancel}
      onCancel={onCancel}
      onConfirm={() => void reject()}
      confirmDisabled={!reasonCode || saving}
      destructive
    >
      <div className="ai-ranking-stage-change ai-ranking-stage-change--danger">
        <div>
          <small>{rejectCopy.current}</small>
          <strong>
            {copy.stageLabels[
              candidate.stage as keyof typeof copy.stageLabels
            ] ?? candidate.stage}
          </strong>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <small>{rejectCopy.next}</small>
          <strong>{rejectCopy.rejected}</strong>
        </div>
      </div>
      <label className="ai-ranking-field">
        <span>
          {rejectCopy.reason} <em>{rejectCopy.required}</em>
        </span>
        <select
          value={reasonCode}
          onChange={(event) =>
            setReasonCode(event.target.value as RejectionReasonCode)
          }
        >
          <option value="">{rejectCopy.selectReason}</option>
          {(
            Object.entries(rejectCopy.reasons) as Array<
              [RejectionReasonCode, string]
            >
          ).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="ai-ranking-field">
        <span>
          {rejectCopy.internalNote} <small>{rejectCopy.optional}</small>
        </span>
        <textarea
          value={internalNote}
          maxLength={2_000}
          onChange={(event) => setInternalNote(event.target.value)}
          rows={3}
          placeholder={rejectCopy.notePlaceholder}
        />
      </label>
      {error ? (
        <p className="ai-ranking-error" role="alert">
          {error}
        </p>
      ) : null}
    </RankingModalFrame>
  );
}
