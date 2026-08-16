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

export function AiAssessmentTab({
  state,
  onRetry,
}: {
  state: ScoringState;
  onRetry: () => void;
}) {
  if (state.kind === "PENDING")
    return <RetryingAssessment automatic={state.automaticMatch} />;
  if (state.kind === "PROCESSING") {
    return (
      <div className="ranking-empty-panel" role="status">
        <LoaderCircle
          aria-hidden="true"
          className="ranking-empty-panel__icon is-spinning"
        />
        <h3>AI assessment is processing</h3>
        <p>
          The deterministic result will stay visible while the initial scoring
          operation runs in the background.
        </p>
        <button
          type="button"
          className="ai-ranking-button ai-ranking-button--loading"
          disabled
        >
          <LoaderCircle aria-hidden="true" className="is-spinning" />{" "}
          Processing…
        </button>
      </div>
    );
  }
  if (state.kind === "NOT_CALCULATED") {
    return (
      <div className="ranking-empty-panel">
        <CircleHelp aria-hidden="true" className="ranking-empty-panel__icon" />
        <h3>AI assessment is not calculated</h3>
        <p>
          There is no published deterministic result to send for AI assessment
          yet.
        </p>
      </div>
    );
  }
  if (state.kind === "UNAVAILABLE")
    return (
      <UnavailableAssessment
        automatic={state.automaticMatch}
        failures={state.consecutiveFailures}
        onRetry={onRetry}
      />
    );
  return (
    <ReadyAssessment
      automatic={state.automaticMatch}
      ai={state.aiAssessment}
      finalScore={state.finalScore}
    />
  );
}

function RetryingAssessment({
  automatic,
}: {
  automatic: AutomaticMatch | null;
}) {
  return (
    <div className="ranking-tab-content">
      <div className="ai-retry-banner" role="status">
        <LoaderCircle aria-hidden="true" className="is-spinning" />
        <div>
          <strong>Retrying AI evaluation</strong>
          <p>
            The {automatic?.score ?? "deterministic"}/100 deterministic result
            stays visible while AI runs in the background.
          </p>
        </div>
        <button
          type="button"
          className="ai-ranking-button ai-ranking-button--loading"
          disabled
        >
          <LoaderCircle aria-hidden="true" className="is-spinning" /> Retrying…
        </button>
      </div>
      <div className="automatic-score-cards">
        <AssessmentMetric
          title="Automatic match"
          value={automatic ? `${automatic.score}/100` : "Ready"}
          meta="Deterministic result preserved"
          tone="blue"
        />
        <AssessmentMetric
          title="AI assessment"
          value="Processing"
          meta="Retry in progress"
          tone="purple"
        />
        <AssessmentMetric
          title="Final score"
          value="Pending"
          meta="Will update when AI succeeds"
          tone="green"
        />
      </div>
      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon">
          <BrainCircuit aria-hidden="true" />
        </span>
        <strong>
          Deterministic {automatic?.score ?? "match"} ready · AI retry in
          progress
        </strong>
        <span>
          {automatic
            ? `JD ${automatic.jdVersion} · CV ${automatic.cvVersion} · Config ${automatic.configVersion}`
            : "Lineage is preserved"}
        </span>
      </div>
    </div>
  );
}

function UnavailableAssessment({
  automatic,
  failures,
  onRetry,
}: {
  automatic: AutomaticMatch;
  failures: number;
  onRetry: () => void;
}) {
  return (
    <div className="ranking-tab-content">
      <div className="ranking-warning ranking-warning--amber" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <strong>AI evaluation is unavailable</strong>
          <p>
            Deterministic matching is complete. No hybrid final score is shown
            until AI succeeds.
          </p>
        </div>
        <button
          type="button"
          className="ai-ranking-button ai-ranking-button--secondary"
          onClick={onRetry}
        >
          <LoaderCircle aria-hidden="true" /> Retry AI evaluation
        </button>
      </div>
      <div className="automatic-score-cards">
        <AssessmentMetric
          title="Automatic match"
          value={`${automatic.score}/100`}
          meta="Ready"
          tone="blue"
        />
        <AssessmentMetric
          title="AI assessment"
          value="Unavailable"
          meta="Retryable state"
          tone="purple"
        />
        <AssessmentMetric
          title="Final score"
          value="Not calculated"
          meta="AI is not substituted with zero"
          tone="green"
        />
      </div>
      <div className="automatic-formula-row">
        <span className="automatic-formula-row__icon">
          <BrainCircuit aria-hidden="true" />
        </span>
        <strong>
          Deterministic match: {automatic.score}/100 · AI unavailable
        </strong>
        <span>
          JD {automatic.jdVersion} · CV {automatic.cvVersion} · Config{" "}
          {automatic.configVersion}
        </span>
      </div>
      {failures >= 3 ? (
        <div className="ranking-support-callout" role="status">
          Repeated AI failure · try later or contact support.
        </div>
      ) : null}
      <p className="ranking-method-note">
        The Automatic match tab remains available, including required skills,
        experience, and CV evidence.
      </p>
    </div>
  );
}

function ReadyAssessment({
  automatic,
  ai,
  finalScore,
}: {
  automatic: AutomaticMatch;
  ai: AiAssessment;
  finalScore: FinalScore;
}) {
  const strengths = ai.findings.filter((item) => item.kind === "STRENGTH");
  const verify = ai.findings.filter((item) => item.kind === "POINT_TO_VERIFY");
  return (
    <div className="ranking-tab-content ai-assessment-tab">
      <section className="ai-overall-card">
        <span className="ai-overall-card__icon" aria-hidden="true">
          <BrainCircuit />
        </span>
        <div>
          <div className="ai-overall-card__heading">
            <h3>Overall assessment</h3>
            <span>AI-generated</span>
          </div>
          <p>{ai.overallSummary}</p>
        </div>
      </section>
      {ai.assessmentLimitedByDataQuality ? (
        <div className="ranking-warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>Low data quality — assessment limited.</strong> Review the
            parsing notes before relying on this score.
          </span>
        </div>
      ) : ai.requiresHumanReview ? (
        <div className="ranking-warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>Human review required.</strong>{" "}
            {ai.humanReviewGuidance ??
              "Review the extraction and evidence before making a recruitment decision."}
          </span>
        </div>
      ) : null}

      <div className="ai-finding-grid">
        <FindingColumn
          title="Evidence-based strengths"
          icon={CheckCircle2}
          items={strengths}
          tone="green"
        />
        <FindingColumn
          title="Points to verify"
          icon={CircleAlert}
          items={verify}
          tone="amber"
        />
      </div>

      <section className="ai-score-reasoning">
        <div className="ai-score-reasoning__score">
          <strong>{ai.score}</strong>
          <span>/ 100 AI points</span>
        </div>
        <div>
          <h3>Why did the AI give a score of {ai.score}?</h3>
          <ul>
            {ai.breakdown.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="ai-confidence-grid">
        <section className="ai-confidence-card">
          <div>
            <span>
              Confidence · {ai.modelVersion} · {ai.promptVersion}
            </span>
            <strong>
              {ai.confidencePercent}% · {ai.confidenceLabel}
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
            <p role="alert">
              Review required — assess the evidence carefully yourself.
            </p>
          ) : null}
        </section>
        <div className="ai-trust-note">
          <ShieldCheck aria-hidden="true" />
          <span>{ai.compliance.label}</span>
        </div>
      </div>

      <section className="ai-questions-card">
        <h3>
          <MessageCircleQuestion aria-hidden="true" /> Suggested interview
          questions
        </h3>
        {ai.questions.kind === "GENERATED" ? (
          <ol>
            {ai.questions.items.map((question, index) => (
              <li key={`${question.pointToVerifyId}-${question.question}`}>
                <span>{index + 1}</span>
                <p>{question.question}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ranking-muted-text">{ai.questions.fallbackMessage}</p>
        )}
      </section>
      <p className="ranking-method-note">
        Formula: {finalScore.formulaText} · Automatic {automatic.score} × 0.6 +
        AI {ai.score} × 0.4
      </p>
    </div>
  );
}

function FindingColumn({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string;
  icon: typeof CheckCircle2;
  items: AiAssessment["findings"];
  tone: "green" | "amber";
}) {
  return (
    <section className={`ai-finding-column ai-finding-column--${tone}`}>
      <h3>
        <Icon aria-hidden="true" /> {title}
      </h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.evidence}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ranking-muted-text">No items returned.</p>
      )}
    </section>
  );
}

function AssessmentMetric({
  title,
  value,
  meta,
  tone,
}: {
  title: string;
  value: string;
  meta: string;
  tone: "blue" | "purple" | "green";
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
            width:
              value === "Unavailable" ||
              value === "Not calculated" ||
              value === "Pending" ||
              value === "Processing"
                ? "60%"
                : "90%",
          }}
        />
      </span>
    </article>
  );
}
