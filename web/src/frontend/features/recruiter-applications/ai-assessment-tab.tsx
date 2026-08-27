"use client";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  LoaderCircle,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";
import type {
  AiAssessment,
  AutomaticMatch,
  FinalScore,
  ScoringState,
} from "@/shared/contracts/scoring";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  applicationDetailCopy,
  type ApplicationDetailCopy,
} from "./application-detail-copy";
import { ScoreBadgeFromLabel } from "./candidate-ranking-ui";
import { ScoringLineage } from "./automatic-match-tab";

export function AiAssessmentTab({
  state,
  onScore,
  canScore = true,
}: {
  state: ScoringState;
  onScore: () => void;
  canScore?: boolean;
}) {
  const copy = applicationDetailCopy(useWorkspaceLocale()).assessment;
  if (state.kind === "PENDING")
    return <RetryingAssessment automatic={state.automaticMatch} copy={copy} />;
  if (state.kind === "PROCESSING") {
    return (
      <div className="ranking-empty-panel" role="status">
        <LoaderCircle
          aria-hidden="true"
          className="ranking-empty-panel__icon is-spinning"
        />
        <h3>{copy.processingTitle}</h3>
        <p>{copy.processingDescription}</p>
        <button
          type="button"
          className="ai-ranking-button ai-ranking-button--loading"
          disabled
        >
          <LoaderCircle aria-hidden="true" className="is-spinning" />{" "}
          {copy.processing}
        </button>
      </div>
    );
  }
  if (state.kind === "NOT_CALCULATED") {
    return (
      <div className="ranking-empty-panel">
        <CircleHelp aria-hidden="true" className="ranking-empty-panel__icon" />
        <h3>{copy.notCalculatedTitle}</h3>
        <p>{copy.notCalculatedDescription}</p>
        {canScore ? (
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--primary"
            onClick={onScore}
          >
            <BrainCircuit aria-hidden="true" /> {copy.scoreCandidate}
          </button>
        ) : (
          <p className="ranking-muted-text">{copy.rankingActions}</p>
        )}
      </div>
    );
  }
  if (state.kind === "FAILED") {
    return (
      <div className="ranking-empty-panel" role="alert">
        <AlertTriangle
          aria-hidden="true"
          className="ranking-empty-panel__icon"
        />
        <h3>{copy.failedTitle}</h3>
        <p>{copy.failedDescription(state.safeFailureCode ?? "")}</p>
        {canScore && state.retryAllowed ? (
          <button
            type="button"
            className="ai-ranking-button ai-ranking-button--primary"
            onClick={onScore}
          >
            <BrainCircuit aria-hidden="true" /> {copy.retryScoring}
          </button>
        ) : null}
      </div>
    );
  }
  if (state.kind === "UNAVAILABLE")
    return (
      <UnavailableAssessment
        automatic={state.automaticMatch}
        failures={state.consecutiveFailures}
        safeFailureCode={state.aiAssessment.safeFailureCode}
        copy={copy}
      />
    );
  return (
    <ReadyAssessment
      automatic={state.automaticMatch}
      ai={state.aiAssessment}
      finalScore={state.finalScore}
      copy={copy}
    />
  );
}

function RetryingAssessment({
  automatic,
  copy,
}: {
  automatic: AutomaticMatch | null;
  copy: ApplicationDetailCopy["assessment"];
}) {
  return (
    <div className="ranking-tab-content">
      <div className="ai-retry-banner" role="status">
        <LoaderCircle aria-hidden="true" className="is-spinning" />
        <div>
          <strong>{copy.retryingTitle}</strong>
          <p>{copy.retryingDescription(automatic?.score ?? "deterministic")}</p>
        </div>
        <button
          type="button"
          className="ai-ranking-button ai-ranking-button--loading"
          disabled
        >
          <LoaderCircle aria-hidden="true" className="is-spinning" />{" "}
          {copy.retrying}
        </button>
      </div>
      <div className="automatic-score-cards">
        <AssessmentMetric
          title={copy.automaticMatch}
          value={automatic ? `${automatic.score}/100` : "Ready"}
          meta={copy.deterministicPreserved}
          tone="blue"
        />
        <AssessmentMetric
          title={copy.aiAssessment}
          value={copy.processing}
          meta={copy.retryInProgress}
          tone="purple"
          muted
        />
        <AssessmentMetric
          title={copy.finalScore}
          value={copy.pending}
          meta={copy.willUpdate}
          tone="green"
          muted
        />
      </div>
      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon">
          <BrainCircuit aria-hidden="true" />
        </span>
        <strong>{copy.formulaRetry(automatic?.score ?? "match")}</strong>
        <ScoringLineage automatic={automatic} />
      </div>
    </div>
  );
}

function UnavailableAssessment({
  automatic,
  failures,
  safeFailureCode,
  copy,
}: {
  automatic: AutomaticMatch;
  failures: number;
  safeFailureCode: string;
  copy: ApplicationDetailCopy["assessment"];
}) {
  return (
    <div className="ranking-tab-content">
      <div className="automatic-score-cards">
        <AssessmentMetric
          title={copy.automaticMatch}
          value={`${automatic.score}/100`}
          meta={copy.ready}
          tone="blue"
        />
        <AssessmentMetric
          title={copy.aiAssessment}
          value={copy.aiUnavailable}
          meta={copy.retryable}
          tone="purple"
          muted
        />
        <AssessmentMetric
          title={copy.finalScore}
          value={copy.notCalculated}
          meta={copy.willNotUseZero}
          tone="green"
          muted
        />
      </div>
      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon">
          <BrainCircuit aria-hidden="true" />
        </span>
        <strong>{copy.formulaUnavailable(automatic.score)}</strong>
        <ScoringLineage automatic={automatic} />
      </div>
      {failures >= 3 ? (
        <div className="ranking-support-callout" role="status">
          {copy.repeatedFailure(safeFailureCode)}
        </div>
      ) : null}
      <p className="ranking-method-note">{copy.methodNote}</p>
    </div>
  );
}

function ReadyAssessment({
  automatic,
  ai,
  finalScore,
  copy,
}: {
  automatic: AutomaticMatch;
  ai: AiAssessment;
  finalScore: FinalScore;
  copy: ApplicationDetailCopy["assessment"];
}) {
  const strengths = ai.strengths;
  const verify = ai.pointsToVerify;
  return (
    <div className="ranking-tab-content ai-assessment-tab">
      <section className="ai-overall-card">
        <span className="ai-overall-card__icon" aria-hidden="true">
          <BrainCircuit />
        </span>
        <div>
          <h3>{copy.overall}</h3>
          <p>{ai.overallSummary}</p>
        </div>
      </section>
      {ai.assessmentLimitedByDataQuality || ai.requiresHumanReview ? (
        <div className="ranking-warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>{copy.humanReview}</strong>{" "}
            {ai.assessmentLimitedByDataQuality
              ? copy.lowQuality
              : (ai.humanReviewGuidance ?? copy.defaultHumanGuidance)}
          </span>
        </div>
      ) : null}
      <div className="ai-finding-grid">
        <FindingColumn
          title={copy.strengths}
          emptyMessage={copy.noStrengths}
          icon={CheckCircle2}
          items={strengths}
          tone="green"
        />
        <FindingColumn
          title={copy.pointsToVerify}
          emptyMessage={copy.noGaps}
          icon={CircleAlert}
          items={verify}
          tone="amber"
        />
      </div>

      <section className="ai-score-reasoning">
        <div className="ai-score-reasoning__score">
          <strong>{ai.score}</strong>
          <span>{copy.aiPoints}</span>
        </div>
        {ai.aiScoreBand ? (
          <div className="ai-score-reasoning__tier">
            <span>{copy.scoreTier}</span>
            <ScoreBadgeFromLabel
              code={ai.aiScoreBand.code}
              label={ai.aiScoreBand.label}
              compact
            />
          </div>
        ) : null}
        <div>
          <h3>{copy.whyScore(ai.score)}</h3>
          <ul>
            {ai.scoreReasoning.breakdown.slice(0, 4).map((line) => (
              <li key={line.category}>
                <strong>
                  {line.category}: {line.points}
                </strong>
                {line.note ? <span> ({line.note})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="ai-confidence-grid">
        <section className="ai-confidence-card">
          <div>
            <span>
              {copy.confidence} &middot; {copy.model} {ai.modelVersion} &middot;{" "}
              {copy.prompt} {ai.promptVersion}
            </span>
            <strong>
              {ai.confidencePercent}% &middot;{" "}
              {ai.confidenceLabel.replace(/\s+confidence$/i, "")}
            </strong>
          </div>
          <div
            className="ai-confidence-track"
            role="progressbar"
            aria-valuenow={ai.confidencePercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${ai.confidencePercent}%` }} />
          </div>
          {ai.requiresHumanReview ? (
            <p role="alert">{copy.reviewRequired}</p>
          ) : null}
          {ai.scoreReasoning.confidence.cappedReason ? (
            <p>{ai.scoreReasoning.confidence.cappedReason}</p>
          ) : null}
        </section>
        <div className="ai-trust-note">
          <ShieldCheck aria-hidden="true" />
          <span>{ai.compliance.label}</span>
        </div>
      </div>

      <section className="ai-questions-card">
        <h3>
          <MessageCircleQuestion aria-hidden="true" /> {copy.suggestedQuestions}
        </h3>
        {ai.suggestedQuestions.length > 0 ? (
          <ol>
            {ai.suggestedQuestions.map((question, index) => (
              <li key={`${index}-${question}`}>
                <span>{index + 1}</span>
                <p>{question}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ranking-muted-text">
            {ai.questionsUnavailableReason ?? copy.noQuestions}
          </p>
        )}
      </section>
      <details className="ai-score-formula">
        <summary>{copy.scoreFormula}</summary>
        <p>
          {finalScore.formulaText} &middot;{" "}
          {copy.automaticFormula(automatic.score)}
          &times; 40% + AI {ai.score} &times; 60%
        </p>
      </details>
    </div>
  );
}

function FindingColumn({
  title,
  icon: Icon,
  items,
  tone,
  emptyMessage,
}: {
  title: string;
  icon: typeof CheckCircle2;
  items: AiAssessment["strengths"] | AiAssessment["pointsToVerify"];
  tone: "green" | "amber";
  emptyMessage: string;
}) {
  return (
    <section className={`ai-finding-column ai-finding-column--${tone}`}>
      <h3>
        <Icon aria-hidden="true" /> {title}
      </h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li
              key={`${item.title}-${"evidence" in item ? item.evidence : item.reason}`}
            >
              <strong>{item.title}</strong>
              <span>{"evidence" in item ? item.evidence : item.reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ranking-muted-text">{emptyMessage}</p>
      )}
    </section>
  );
}

function AssessmentMetric({
  title,
  value,
  meta,
  tone,
  muted = false,
}: {
  title: string;
  value: string;
  meta: string;
  tone: "blue" | "purple" | "green";
  muted?: boolean;
}) {
  return (
    <article className={`automatic-score-card automatic-score-card--${tone}`}>
      <div>
        <span>{title}</span>
        <small>{meta}</small>
      </div>
      <strong>{value}</strong>
      <span className="automatic-score-card__track">
        <span
          style={{
            width: muted ? "60%" : "90%",
          }}
        />
      </span>
    </article>
  );
}
