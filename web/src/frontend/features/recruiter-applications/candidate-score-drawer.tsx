"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  FileText,
  Mail,
  MoveRight,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import type {
  RankedApplicationRow,
  ScoringDetail,
  ScoringState,
} from "@/shared/contracts/scoring";
import { scoringDetailSchema } from "@/shared/contracts/scoring";
import { AutomaticMatchTab } from "./automatic-match-tab";
import { AiAssessmentTab } from "./ai-assessment-tab";
import { DocumentsTab } from "./documents-tab";
import { RankingModalFrame } from "./ranking-modal-frame";
import { ScoreBadgeFromLabel, formatScore } from "./candidate-ranking-ui";

type Tab = "automatic" | "ai" | "documents";

export function CandidateScoreDrawer({
  jobId,
  jobTitle,
  candidate,
  onClose,
  onSetPriority,
  onMoveToInterview,
  onReject,
}: {
  jobId: string;
  jobTitle: string;
  candidate: RankedApplicationRow;
  onClose: () => void;
  onSetPriority: () => void;
  onMoveToInterview: () => void;
  onReject: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "automatic";
    const stored = window.sessionStorage.getItem("smartHire.scoreDrawerTab");
    return stored === "automatic" || stored === "ai" || stored === "documents"
      ? stored
      : "automatic";
  });
  const [detail, setDetail] = useState<ScoringDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [openDocument, setOpenDocument] = useState<
    "cv" | "cover-letter" | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/recruiter/applications/${encodeURIComponent(candidate.applicationId)}/scoring`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.message ?? "Unable to load score explanation.",
          );
        return scoringDetailSchema.parse(payload);
      })
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load score explanation.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.applicationId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !retryConfirm) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, retryConfirm]);

  const scoring = detail?.scoring ?? rowToScoring(candidate);
  const finalScore = scoring.kind === "SCORED" ? scoring.finalScore : null;
  const automatic =
    scoring.kind === "SCORED" ||
    scoring.kind === "UNAVAILABLE" ||
    scoring.kind === "PENDING"
      ? scoring.automaticMatch
      : null;
  const scoreValue =
    scoring.kind === "SCORED"
      ? (finalScore?.value ?? null)
      : scoring.kind === "UNAVAILABLE" ||
          scoring.kind === "PENDING" ||
          scoring.kind === "PROCESSING"
        ? null
        : candidate.scoreSummary.final;
  const badge =
    scoring.kind === "SCORED"
      ? (finalScore?.band ?? null)
      : scoring.kind === "UNAVAILABLE" ||
          scoring.kind === "PENDING" ||
          scoring.kind === "PROCESSING"
        ? null
        : candidate.scoreSummary.band;
  const headerScore =
    scoring.kind === "PENDING"
      ? "Pending"
      : scoreValue === null
        ? "—/100"
        : `${formatScore(scoreValue)}/100`;
  const headerLabel =
    badge?.label ??
    (scoring.kind === "PROCESSING"
      ? "Processing"
      : scoring.kind === "PENDING"
        ? "Retrying AI"
        : scoring.kind === "UNAVAILABLE"
          ? "Rule-based only"
          : "Not calculated");
  const headerCode =
    badge?.code ??
    (scoring.kind === "UNAVAILABLE" ? "RULE_BASED" : scoring.kind);

  const retry = async () => {
    setRetryConfirm(false);
    try {
      const response = await fetch(
        `/api/recruiter/applications/${encodeURIComponent(candidate.applicationId)}/scoring/retry-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? `retry-${Date.now()}`,
          },
          body: JSON.stringify({ confirmed: true }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.scoring)
        setDetail((current) =>
          current ? { ...current, scoring: payload.scoring } : current,
        );
      else setError(payload?.message ?? "AI retry could not be started.");
    } catch {
      setError(
        "AI retry could not be started. Check your connection and try again.",
      );
    }
  };
  const changeTab = (next: Tab) => {
    setActiveTab(next);
    window.sessionStorage.setItem("smartHire.scoreDrawerTab", next);
  };

  return (
    <div
      className="ranking-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="ranking-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-ranking-drawer-title"
      >
        <header className="ranking-drawer__header">
          <div className="ranking-drawer__identity">
            <div
              className="ranking-avatar ranking-avatar--large"
              aria-hidden="true"
            >
              {candidate.candidate.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 id="ai-ranking-drawer-title">
                {candidate.candidate.displayName}
              </h2>
              <p>Applying for {jobTitle}</p>
              <span>
                <Mail aria-hidden="true" /> {candidate.candidate.verifiedEmail}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="ranking-icon-button"
            onClick={onClose}
            aria-label="Close candidate details"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="ranking-drawer__scoreline">
          <div className="ranking-drawer__score">
            <strong>{headerScore}</strong>
            <span>
              {scoring.kind === "UNAVAILABLE"
                ? "Hybrid score unavailable"
                : scoring.kind === "PENDING"
                  ? "Hybrid score pending"
                  : "Final score"}
            </span>
          </div>
          <ScoreBadgeFromLabel code={headerCode} label={headerLabel} />
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={() => {
              setOpenDocument("cv");
              changeTab("documents");
            }}
          >
            <FileText aria-hidden="true" /> View CV
          </button>
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--secondary"
            onClick={() => {
              setOpenDocument("cover-letter");
              changeTab("documents");
            }}
          >
            <Mail aria-hidden="true" /> View cover letter
          </button>
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--primary"
            onClick={onMoveToInterview}
            disabled={!candidate.allowedActions.moveToInterview.allowed}
          >
            <ArrowRight aria-hidden="true" /> Move to interview
          </button>
        </div>

        <nav
          className="ranking-drawer__tabs"
          role="tablist"
          aria-label="Candidate score details"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "automatic"}
            className={activeTab === "automatic" ? "is-active" : ""}
            onClick={() => changeTab("automatic")}
          >
            <span>Automatic match</span>
            <small>System computed</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ai"}
            className={activeTab === "ai" ? "is-active" : ""}
            onClick={() => changeTab("ai")}
          >
            <BrainCircuit aria-hidden="true" />
            <span>AI assessment</span>
            <small>Evidence-based</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "documents"}
            className={activeTab === "documents" ? "is-active" : ""}
            onClick={() => changeTab("documents")}
          >
            <span>CV &amp; Cover letter</span>
            <small>Source documents</small>
          </button>
        </nav>

        <div className="ranking-drawer__body">
          {error ? (
            <div className="ranking-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          ) : null}
          {scoring.kind === "UNAVAILABLE" ? (
            <div
              className="drawer-state-banner drawer-state-banner--warning"
              role="status"
            >
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>AI evaluation unavailable</strong>
                <span>
                  Deterministic matching is complete. The rule-based score and
                  CV evidence remain visible.
                </span>
              </div>
              <button type="button" onClick={() => setRetryConfirm(true)}>
                <RefreshCw aria-hidden="true" /> Retry AI evaluation
              </button>
            </div>
          ) : scoring.kind === "PENDING" ? (
            <div
              className="drawer-state-banner drawer-state-banner--info"
              role="status"
            >
              <RefreshCw aria-hidden="true" className="is-spinning" />
              <div>
                <strong>Deterministic ready · AI retry in progress</strong>
                <span>
                  The {automatic?.score ?? "deterministic"}/100 result stays
                  visible while AI runs in the background.
                </span>
              </div>
            </div>
          ) : scoring.kind === "PROCESSING" ? (
            <div
              className="drawer-state-banner drawer-state-banner--info"
              role="status"
            >
              <RefreshCw aria-hidden="true" className="is-spinning" />
              <div>
                <strong>Scoring in progress</strong>
                <span>
                  Partial results will appear here without blocking the rest of
                  the candidate list.
                </span>
              </div>
            </div>
          ) : null}
          {detail?.rescoreInProgress ? (
            <div className="drawer-rescore-note" role="status">
              <RefreshCw aria-hidden="true" className="is-spinning" /> Rescoring
              in progress · the current result stays visible.
            </div>
          ) : null}
          {activeTab === "automatic" ? (
            <AutomaticMatchTab
              automatic={automatic}
              finalScore={finalScore}
              aiScore={
                scoring.kind === "SCORED" ? scoring.aiAssessment.score : null
              }
              retrying={scoring.kind === "PENDING"}
            />
          ) : activeTab === "ai" ? (
            <AiAssessmentTab
              state={scoring}
              onRetry={() => setRetryConfirm(true)}
            />
          ) : (
            <DocumentsTab
              key={openDocument ?? "documents"}
              jobId={jobId}
              applicationId={candidate.applicationId}
              automatic={automatic}
              dataQualityNotes={
                scoring.kind === "SCORED"
                  ? scoring.aiAssessment.dataQualityNotes
                  : []
              }
              openKind={openDocument}
            />
          )}
        </div>

        <footer className="ranking-drawer__footer">
          <div className="ranking-drawer__human-note">
            <UserRoundCheck aria-hidden="true" />
            <span>
              <strong>Human decision</strong>
              <small>Score unchanged</small>
            </span>
          </div>
          <div className="ranking-drawer__actions">
            <button
              type="button"
              className="ai-ranking-button ai-ranking-button--secondary"
              onClick={onSetPriority}
            >
              <ShieldCheck aria-hidden="true" />{" "}
              {candidate.manuallyPrioritized ? "Edit priority" : "Set priority"}
            </button>
            <button
              type="button"
              className="ai-ranking-button ai-ranking-button--primary"
              onClick={onMoveToInterview}
              disabled={!candidate.allowedActions.moveToInterview.allowed}
            >
              <MoveRight aria-hidden="true" /> Move to interview
            </button>
            <button
              type="button"
              className="ai-ranking-button ai-ranking-button--danger-outline"
              onClick={onReject}
              disabled={!candidate.allowedActions.reject.allowed}
            >
              <UserRoundCheck aria-hidden="true" /> Reject
            </button>
          </div>
        </footer>
      </aside>
      {retryConfirm ? (
        <RankingModalFrame
          title="Retry AI evaluation?"
          subtitle={`${candidate.candidate.displayName} · AI-only retry`}
          icon="AI"
          info="The deterministic result stays visible and is not recomputed. This retry is recorded as a recruiter action."
          confirmLabel="Retry AI evaluation"
          onCancel={() => setRetryConfirm(false)}
          onConfirm={() => void retry()}
        />
      ) : null}
    </div>
  );
}

function rowToScoring(candidate: RankedApplicationRow): ScoringState {
  if (candidate.scoring.kind === "PROCESSING")
    return {
      kind: "PROCESSING",
      label: "Processing",
      operationId: candidate.scoring.operationId,
    };
  if (candidate.scoring.kind === "PENDING")
    return {
      kind: "PENDING",
      label: "Pending",
      operationId: candidate.scoring.operationId,
      automaticMatch: null,
    };
  return { kind: "NOT_CALCULATED", label: "Not calculated" };
}
