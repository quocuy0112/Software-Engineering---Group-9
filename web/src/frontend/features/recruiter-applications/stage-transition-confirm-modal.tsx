"use client";

import { useState } from "react";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationDetailCopy } from "./application-detail-copy";

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
  const copy = applicationDetailCopy(useWorkspaceLocale());
  const transitionCopy = copy.transition;
  const csrfProof = useCsrfProof();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoShortlist = candidate.stage === "VIEWED";
  const confirm = async () => {
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
              "/decisions/interview",
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
      if (!response.ok) throw new Error(transitionCopy.error);
      onCompleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : transitionCopy.error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <RankingModalFrame
      title={transitionCopy.title}
      subtitle={transitionCopy.subtitle}
      icon="→"
      info={
        <>
          <UserRoundCheck aria-hidden="true" />
          <span>
            {transitionCopy.info}
            {autoShortlist ? transitionCopy.viewedInfo : ""}
          </span>
        </>
      }
      confirmLabel={saving ? transitionCopy.moving : transitionCopy.confirm}
      cancelLabel={transitionCopy.cancel}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmDisabled={saving}
    >
      {autoShortlist ? (
        <div className="ai-ranking-stage-change">
          <div>
            <small>{transitionCopy.current}</small>
            <strong>{copy.stageLabels.VIEWED}</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>{transitionCopy.recorded}</small>
            <strong>{copy.stageLabels.SHORTLISTED}</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>{transitionCopy.next}</small>
            <strong>{copy.stageLabels.INTERVIEWING}</strong>
          </div>
        </div>
      ) : (
        <div className="ai-ranking-stage-change">
          <div>
            <small>{transitionCopy.current}</small>
            <strong>
              {copy.stageLabels[
                candidate.stage as keyof typeof copy.stageLabels
              ] ?? candidate.stage}
            </strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <small>{transitionCopy.next}</small>
            <strong>{copy.stageLabels.INTERVIEWING}</strong>
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
