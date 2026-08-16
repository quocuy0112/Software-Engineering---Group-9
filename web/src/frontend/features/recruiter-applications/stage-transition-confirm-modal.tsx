"use client";

import { useState } from "react";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import type { RankedApplicationRow } from "@/shared/contracts/scoring";
import { RankingModalFrame } from "./ranking-modal-frame";

function stageLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function StageTransitionConfirmModal({
  candidate,
  onCancel,
  onCompleted,
}: {
  candidate: RankedApplicationRow;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/recruiter/applications/" +
          encodeURIComponent(candidate.applicationId) +
          "/decisions/interview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? "interview-" + Date.now(),
          },
          body: JSON.stringify({
            confirmed: true,
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
          </span>
        </>
      }
      confirmLabel={saving ? "Moving…" : "Confirm move"}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
      confirmDisabled={saving}
    >
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
      {error ? (
        <p className="ai-ranking-error" role="alert">
          {error}
        </p>
      ) : null}
    </RankingModalFrame>
  );
}
