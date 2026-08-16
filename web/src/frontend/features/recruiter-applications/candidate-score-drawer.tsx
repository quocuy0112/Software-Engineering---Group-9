"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  LoaderCircle,
  Mail,
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
  onScoringChanged,
}: {
  jobId: string;
  jobTitle: string;
  candidate: RankedApplicationRow;
  onClose: () => void;
  onSetPriority: () => void;
  onMoveToInterview: () => void;
  onReject: () => void;
  onScoringChanged: () => void;
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
  const [scoreConfirm, setScoreConfirm] = useState(false);
  const [scoringActionLoading, setScoringActionLoading] = useState(false);
  const [openDocument, setOpenDocument] = useState<
    "cv" | "cover-letter" | null
  >(null);
  const [openDocumentRequest, setOpenDocumentRequest] = useState(0);

  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(
        `/api/recruiter/applications/${encodeURIComponent(candidate.applicationId)}/scoring`,
        { cache: "no-store", signal },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message ?? "Unable to load score explanation.");
      const next = scoringDetailSchema.parse(payload);
      return next;
    },
    [candidate.applicationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDetail(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setDetail(next);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load score explanation.",
          );
      });
    return () => controller.abort();
  }, [loadDetail]);

  useEffect(() => {
    if (
      !detail ||
      !(
        detail.rescoreInProgress ||
        detail.scoring.kind === "PROCESSING" ||
        detail.scoring.kind === "PENDING"
      )
    )
      return;
    const timer = window.setInterval(() => {
      void loadDetail()
        .then((next) => {
          const wasInProgress =
            detail.rescoreInProgress ||
            detail.scoring.kind === "PROCESSING" ||
            detail.scoring.kind === "PENDING";
          const hasFinished =
            !next.rescoreInProgress &&
            next.scoring.kind !== "PROCESSING" &&
            next.scoring.kind !== "PENDING";
          if (wasInProgress && hasFinished) onScoringChanged();
          setDetail(next);
        })
        .catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [detail, loadDetail, onScoringChanged]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !retryConfirm && !scoreConfirm) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, retryConfirm, scoreConfirm]);

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
  const canScoreCandidate =
    detail?.scoring.kind === "NOT_CALCULATED" ||
    detail?.scoring.kind === "SCORED";
  const scoreActionLabel =
    detail?.scoring.kind === "SCORED" ? "Rescore candidate" : "Score candidate";

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
  const scoreCandidate = async () => {
    setScoreConfirm(false);
    setScoringActionLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/recruiter/applications/${encodeURIComponent(candidate.applicationId)}/scoring/score`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              globalThis.crypto?.randomUUID?.() ?? `score-${Date.now()}`,
          },
          body: JSON.stringify({ confirmed: true }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          payload?.message ?? "Candidate scoring could not be started.",
        );
      setDetail(await loadDetail());
      onScoringChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Candidate scoring could not be started. Check your connection and try again.",
      );
    } finally {
      setScoringActionLoading(false);
    }
  };
  const changeTab = (next: Tab) => {
    if (next !== "documents") setOpenDocument(null);
    setActiveTab(next);
    window.sessionStorage.setItem("smartHire.scoreDrawerTab", next);
  };
  const requestDocument = (kind: "cv" | "cover-letter") => {
    setOpenDocument(kind);
    setOpenDocumentRequest((current) => current + 1);
    changeTab("documents");
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
          <div className="ranking-drawer__score-summary">
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
          </div>
          <div className="ranking-drawer__scoreline-actions">
            <button
              type="button"
              className="ai-ranking-button ai-ranking-button--secondary"
              onClick={() => requestDocument("cv")}
            >
              <FileText aria-hidden="true" /> View CV
            </button>
            <button
              type="button"
              className="ai-ranking-button ai-ranking-button--secondary"
              onClick={() => requestDocument("cover-letter")}
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
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ai"}
            className={activeTab === "ai" ? "is-active" : ""}
            onClick={() => changeTab("ai")}
          >
            <span>AI assessment</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "documents"}
            className={activeTab === "documents" ? "is-active" : ""}
            onClick={() => changeTab("documents")}
          >
            <span>CV &amp; Cover letter</span>
          </button>
        </nav>

        <div className="ranking-drawer__body">
          {error ? (
            <div className="ranking-error" role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void loadDetail().catch((cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Unable to load score explanation.",
                    ),
                  );
                }}
              >
                Retry
              </button>
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
                  {aiUnavailableMessage(scoring.aiAssessment.safeFailureCode)}
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
              onScore={() => setScoreConfirm(true)}
            />
          ) : (
            <DocumentsTab
              key={`${openDocument ?? "documents"}-${openDocumentRequest}`}
              jobId={jobId}
              applicationId={candidate.applicationId}
              automatic={automatic}
              dataQualityNotes={
                scoring.kind === "SCORED"
                  ? scoring.aiAssessment.dataQualityNotes
                  : []
              }
              openKind={openDocument}
              openRequest={openDocumentRequest}
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
            {canScoreCandidate ? (
              <button
                type="button"
                className="ai-ranking-button ai-ranking-button--secondary"
                onClick={() => setScoreConfirm(true)}
                disabled={scoringActionLoading}
              >
                {scoringActionLoading ? (
                  <LoaderCircle aria-hidden="true" className="is-spinning" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}{" "}
                {scoreActionLabel}
              </button>
            ) : null}
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
      {scoreConfirm ? (
        <RankingModalFrame
          title={`${scoreActionLabel}?`}
          subtitle={`${candidate.candidate.displayName} · one application`}
          icon="AI"
          info="Only this candidate will be queued. The score and assessment will update here when the background worker finishes."
          confirmLabel={scoreActionLabel}
          confirmDisabled={scoringActionLoading}
          onCancel={() => setScoreConfirm(false)}
          onConfirm={() => void scoreCandidate()}
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

function aiUnavailableMessage(code: string) {
  if (code === "AI_PROVIDER_INVALID_REQUEST")
    return "The AI provider rejected the assessment request. Check the provider/model configuration before retrying.";
  if (code === "AI_PROVIDER_MODEL_NOT_FOUND")
    return "The configured AI model is unavailable. Update the model configuration before retrying.";
  if (code === "AI_PROVIDER_AUTHENTICATION")
    return "The AI provider authentication failed. Check the server API key before retrying.";
  if (code === "AI_PROVIDER_POLICY_NOT_APPROVED")
    return "AI scoring is disabled by the current privacy or local-development configuration.";
  if (code === "AI_PROVIDER_NOT_CONFIGURED")
    return "The AI provider is not configured. Add the approved provider settings before retrying.";
  if (code === "AI_PROVIDER_MALFORMED")
    return "The AI provider returned an assessment that could not be validated. Restart the scoring worker and retry once.";
  return "Deterministic matching is complete. The rule-based score and CV evidence remain visible while the AI provider is unavailable.";
}
