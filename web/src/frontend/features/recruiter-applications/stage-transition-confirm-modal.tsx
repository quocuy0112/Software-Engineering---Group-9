"use client";

import { useState } from "react";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";

function stageLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function StageTransitionConfirmModal({
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
  const csrfProof = useCsrfProof();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoShortlist = candidate.stage === "VIEWED";
  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        jobId ? "/api/recruiter/jobs/" + encodeURIComponent(jobId) + "/applications/" + encodeURIComponent(candidate.applicationId) + "/stage" : "/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/decisions/interview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? "interview-" + Date.now(),
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify({
            targetStage: "INTERVIEWING",
            expectedStageVersion: candidate.stageVersion,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          payload?.message ??
            "The interview transition could not be completed.",
        );
      onCompleted();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The interview transition could not be completed.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <RankingModalFrame
      title="Move candidate to interview?"
      subtitle="Explicit recruiter decision · Application stage update"
      icon="→"
      info={
        <>
          <UserRoundCheck aria-hidden="true" />
          <span>
            This transition is made by you, not by AI. The action is recorded in
            stage history and the candidate is notified.
            {autoShortlist
              ? " Because this candidate is Viewed, the action records Shortlisted before Interviewing."
              : ""}
          </span>
        </>
      }
      confirmLabel={saving ? "Moving…" : "Confirm move"}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmDisabled={saving}
    >
      {autoShortlist ? (
        <div className="ai-ranking-stage-change">
          <div>
            <small>Current stage</small>
            <strong>Viewed</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>Recorded stage</small>
            <strong>Shortlisted</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>Next stage</small>
            <strong>Interviewing</strong>
          </div>
        </div>
      ) : (
        <div className="ai-ranking-stage-change">
          <div>
            <small>Current stage</small>
            <strong>{stageLabel(candidate.stage)}</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>Next stage</small>
            <strong>Interviewing</strong>
          </div>
        </div>
      )}
      {error ? (
        <p className="ai-ranking-error" role="alert">
          {error}
        </p>
      ) : null}
    </RankingModalFrame>
  );
}
