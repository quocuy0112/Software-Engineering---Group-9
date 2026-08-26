"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { RankingModalFrame } from "./ranking-modal-frame";

export function RescoreConfirmModal({
  jobId,
  jobTitle,
  totalCount,
  onCancel,
  onCompleted,
}: {
  jobId: string;
  jobTitle: string;
  totalCount: number;
  onCancel: () => void;
  onCompleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const start = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/recruiter/jobs/" + encodeURIComponent(jobId) + "/scoring/rescore",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? "rescore-" + Date.now(),
          },
          body: JSON.stringify({
            confirmed: true,
            jdVersion: "JD-v3",
            scoringConfigVersion: "HS-40/60-v1",
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          payload?.message ?? "The background rescore could not be started.",
        );
      onCompleted();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The background rescore could not be started.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <RankingModalFrame
      title="Rescore candidates?"
      subtitle={`${jobTitle} · Campaign-wide scoring refresh`}
      icon="↻"
      info={
        <>
          <strong>Current results stay visible during rescoring.</strong> Manual
          priorities are preserved. If AI is unavailable, the deterministic
          fallback remains visible for each candidate.
        </>
      }
      confirmLabel={saving ? "Starting…" : "Start background rescore"}
      onCancel={onCancel}
      onConfirm={() => void start()}
      confirmDisabled={saving}
    >
      <p className="ai-ranking-modal__lead">
        This will rescore{" "}
        <strong>{totalCount.toLocaleString("en-US")} applications</strong> using
        the 40/60 hybrid method (40% automatic matching and 60% AI evaluation).
      </p>
      <dl className="ai-ranking-modal__facts">
        <div>
          <dt>
            <span>
              <CheckCircle2 aria-hidden="true" /> Job description
            </span>
          </dt>
          <dd>JD v3</dd>
        </div>
        <div>
          <dt>
            <ShieldCheck aria-hidden="true" />
            <span>Scoring config</span>
          </dt>
          <dd>HS-40/60-v1</dd>
        </div>
        <div>
          <dt>
            <Clock3 aria-hidden="true" />
            <span>Execution mode</span>
          </dt>
          <dd>Background job</dd>
        </div>
      </dl>
      <div className="rescore-modal-notes">
        <span>
          <RefreshCw aria-hidden="true" /> Existing scores stay visible until
          replacement results are ready.
        </span>
        <span>
          <AlertCircle aria-hidden="true" /> AI failures do not overwrite
          deterministic evidence.
        </span>
      </div>
      {error ? (
        <p className="ai-ranking-error" role="alert">
          {error}
        </p>
      ) : null}
    </RankingModalFrame>
  );
}
