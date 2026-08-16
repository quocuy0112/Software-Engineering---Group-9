"use client";

import { useEffect, useState } from "react";
import type { RankedApplicationRow, ScoringDetail, ScoringState } from "@/shared/contracts/scoring";
import { scoringDetailSchema } from "@/shared/contracts/scoring";
import { AutomaticMatchTab } from "./automatic-match-tab";
import { AiAssessmentTab } from "./ai-assessment-tab";
import { DocumentsTab } from "./documents-tab";
import { RankingModalFrame } from "./ranking-modal-frame";

type Tab = "automatic" | "ai" | "documents";

export function CandidateScoreDrawer({ jobId, jobTitle, candidate, onClose, onSetPriority, onMoveToInterview, onReject }: { jobId: string; jobTitle: string; candidate: RankedApplicationRow; onClose: () => void; onSetPriority: () => void; onMoveToInterview: () => void; onReject: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>(() => (typeof window !== "undefined" && (window.sessionStorage.getItem("smartHire.scoreDrawerTab") as Tab)) || "automatic");
  const [detail, setDetail] = useState<ScoringDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryConfirm, setRetryConfirm] = useState(false);
  const [openDocument, setOpenDocument] = useState<"cv" | "cover-letter" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/scoring", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Unable to load score explanation.");
        return scoringDetailSchema.parse(payload);
      })
      .then((next) => { if (!cancelled) setDetail(next); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load score explanation."); });
    return () => { cancelled = true; };
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
  const automatic = scoring.kind === "SCORED" || scoring.kind === "UNAVAILABLE" || scoring.kind === "PENDING" ? scoring.automaticMatch : null;
  const scoreValue = finalScore?.value ?? candidate.scoreSummary.final;
  const badge = finalScore?.band ?? candidate.scoreSummary.band;
  const headerScore = scoring.kind === "PENDING" ? "Pending" : scoreValue === null ? String.fromCharCode(8212) : String(scoreValue) + "/100";
  const headerLabel = badge?.label ?? (scoring.kind === "PROCESSING" ? "Processing" : scoring.kind === "PENDING" ? "Pending" : scoring.kind === "UNAVAILABLE" ? "Rule-based only" : "Not calculated");

  const retry = async () => {
    setRetryConfirm(false);
    const response = await fetch("/api/recruiter/applications/" + encodeURIComponent(candidate.applicationId) + "/scoring/retry-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": globalThis.crypto?.randomUUID?.() ?? "retry-" + Date.now() },
      body: JSON.stringify({ confirmed: true }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.scoring) setDetail((current) => current ? { ...current, scoring: payload.scoring } : current);
    else setError(payload?.message ?? "AI retry could not be started.");
  };
  const changeTab = (next: Tab) => {
    setActiveTab(next);
    window.sessionStorage.setItem("smartHire.scoreDrawerTab", next);
  };

  return (
    <div className="ai-ranking-drawer-backdrop" role="presentation">
      <aside className="ai-ranking-drawer" role="dialog" aria-modal="true" aria-labelledby="ai-ranking-drawer-title">
        <header className="ai-ranking-drawer__header">
          <div className="ai-ranking-drawer__identity"><div className="ai-ranking-avatar" aria-hidden="true">{candidate.candidate.displayName.slice(0, 1)}</div><div><h2 id="ai-ranking-drawer-title">{candidate.candidate.displayName}</h2><p>Applying for {jobTitle}</p><span>{candidate.candidate.verifiedEmail}</span></div></div>
          <button type="button" className="ai-ranking-icon-button" onClick={onClose} aria-label="Close candidate details">&times;</button>
        </header>
        <div className="ai-ranking-drawer__scoreline">
          <div><strong>{headerScore}</strong><span>Final score</span></div>
          <span className={"ai-ranking-match-badge ai-ranking-match-badge--" + (badge?.code ?? "processing")}><span aria-hidden="true">{badge?.iconLabel ?? String.fromCharCode(8635)}</span>{headerLabel}</span>
          <button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={() => { setOpenDocument("cv"); changeTab("documents"); }}>&#128196; <span>View CV</span></button>
          <button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={() => { setOpenDocument("cover-letter"); changeTab("documents"); }}>&#9993; <span>View cover letter</span></button>
          <button type="button" className="ai-ranking-button ai-ranking-button--primary" onClick={onMoveToInterview} disabled={!candidate.allowedActions.moveToInterview.allowed}>Move to interview</button>
        </div>
        <div className="ai-ranking-drawer__notice" role="note">Scores support decision-making only. The recruiter makes the final decision.</div>
        <nav className="ai-ranking-drawer__tabs" role="tablist" aria-label="Candidate score details">
          <button type="button" role="tab" aria-selected={activeTab === "automatic"} className={activeTab === "automatic" ? "is-active" : ""} onClick={() => changeTab("automatic")}>Automatic match</button>
          <button type="button" role="tab" aria-selected={activeTab === "ai"} className={activeTab === "ai" ? "is-active" : ""} onClick={() => changeTab("ai")}>AI assessment</button>
          <button type="button" role="tab" aria-selected={activeTab === "documents"} className={activeTab === "documents" ? "is-active" : ""} onClick={() => changeTab("documents")}>CV &amp; Cover letter</button>
        </nav>
        <div className="ai-ranking-drawer__body">
          {error ? <div className="ai-ranking-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div> : null}
          {detail?.rescoreInProgress ? <div className="ai-ranking-progress-banner" role="status">Rescoring in progress - results will update automatically. The current result stays visible.</div> : null}
          {activeTab === "automatic" ? <AutomaticMatchTab automatic={automatic} finalScore={finalScore} retrying={scoring.kind === "PENDING"} /> : activeTab === "ai" ? <AiAssessmentTab state={scoring} onRetry={() => setRetryConfirm(true)} /> : <DocumentsTab key={openDocument ?? "documents"} jobId={jobId} applicationId={candidate.applicationId} automatic={automatic} dataQualityNotes={scoring.kind === "SCORED" ? scoring.aiAssessment.dataQualityNotes : []} openKind={openDocument} />}
        </div>
        <footer className="ai-ranking-drawer__footer">
          <button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={onSetPriority}>{String.fromCharCode(9734)} {candidate.manuallyPrioritized ? "Edit priority" : "Set priority"}</button>
          <button type="button" className="ai-ranking-button ai-ranking-button--secondary" onClick={onMoveToInterview} disabled={!candidate.allowedActions.moveToInterview.allowed}>Move to interview</button>
          <button type="button" className="ai-ranking-button ai-ranking-button--danger-outline" onClick={onReject} disabled={!candidate.allowedActions.reject.allowed}>Reject</button>
        </footer>
      </aside>
      {retryConfirm ? <RankingModalFrame title="Retry AI evaluation?" subtitle={candidate.candidate.displayName + " - AI-only retry"} icon={String.fromCharCode(8635)} info="The deterministic result stays visible and is not recomputed. This retry is recorded as a recruiter action." confirmLabel="Retry AI evaluation" onCancel={() => setRetryConfirm(false)} onConfirm={() => void retry()} /> : null}
    </div>
  );
}

function rowToScoring(candidate: RankedApplicationRow): ScoringState {
  if (candidate.scoring.kind === "PROCESSING") return { kind: "PROCESSING", label: "Processing", operationId: candidate.scoring.operationId };
  if (candidate.scoring.kind === "PENDING") return { kind: "PENDING", label: "Pending", operationId: candidate.scoring.operationId, automaticMatch: null };
  return { kind: "NOT_CALCULATED", label: "Not calculated" };
}
