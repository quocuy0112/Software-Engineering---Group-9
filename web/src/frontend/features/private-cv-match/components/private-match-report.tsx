"use client";

import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleAlert,
  FileSearch,
  Gauge,
  ListChecks,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  FullPrivateReport,
  LimitedPrivateReport,
  PrivateRequirementGap,
  PrivateRequirementMatch,
} from "@/shared/contracts/private-cv-match";
import { PrivateMatchDeleteControl } from "./private-match-delete-control";

type PrivateReport = FullPrivateReport | LimitedPrivateReport;

function number(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function bandLabel(report: PrivateReport) {
  if (report.view === "LIMITED_REPORT") return "AI evaluation unavailable";
  if (report.matchBand === "HIGH_MATCH") return "Strong match";
  if (report.matchBand === "MEDIUM_MATCH") return "Good match";
  return "Low match";
}

function reportHeadline(report: FullPrivateReport) {
  if (report.matchBand === "HIGH_MATCH") return "You meet most core requirements";
  if (report.matchBand === "MEDIUM_MATCH") return "You meet several core requirements";
  return "Review the evidence before you apply";
}

function applyHref(report: PrivateReport) {
  const params = new URLSearchParams({
    apply: "true",
    jobId: report.job.jobId,
    cvVersionId: report.cv.versionId,
  });
  return `/jobs/${encodeURIComponent(report.job.slug)}?${params.toString()}`;
}

function Progress({ value, label }: { value: number | null; label: string }) {
  const text = value === null ? "unavailable" : `${value}%`;
  return (
    <div className="private-match-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
      <span style={{ width: `${value === null ? 0 : Math.min(100, Math.max(0, value))}%` }} />
      <span className="private-match-visually-hidden">{label}: {text}</span>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  score,
  meta,
  caption,
  progress,
  unavailable = false,
}: {
  icon: React.ReactNode;
  title: string;
  score: string;
  meta: string;
  caption: string;
  progress: number | null;
  unavailable?: boolean;
}) {
  return (
    <article className={`private-match-metric-card ${unavailable ? "is-unavailable" : ""}`}>
      <h3><span className="private-match-metric-icon">{icon}</span>{title}</h3>
      <strong>{score}</strong>
      <span className="private-match-metric-meta">{meta}</span>
      <Progress value={progress} label={title} />
      <p>{caption}</p>
    </article>
  );
}

function confidenceLabel(value: number) {
  return value >= 80 ? "High confidence" : value >= 60 ? "Medium confidence" : "Low confidence";
}

function gapClassName(kind: PrivateRequirementGap["kind"]) {
  return `private-match-gap-list-item--${kind.toLowerCase()}`;
}

function RequirementChip({ item }: { item: PrivateRequirementMatch }) {
  const matched = item.matched;
  const preferred = item.kind === "PREFERRED";
  return (
    <span className={`private-match-chip ${matched ? "private-match-chip--matched" : "private-match-chip--unmatched"} ${preferred ? "private-match-chip--preferred" : "private-match-chip--required"}`}>
      {matched ? <Check aria-hidden="true" /> : <span aria-hidden="true">+</span>}
      {item.label}
      {!matched && preferred ? " — preferred" : !matched ? " — missing" : null}
    </span>
  );
}

function evidenceTypeLabel(type: string) {
  switch (type) {
    case "PROJECT": return "Project";
    case "IMPACT": return "Impact";
    case "SKILL": return "Skill";
    case "EXPERIENCE": return "Experience";
    case "EDUCATION": return "Education";
    default: return "Other";
  }
}

export function PrivateMatchReport({
  checkId,
  report,
  onRetry,
  retrying = false,
  retryError,
}: {
  checkId: string;
  report: PrivateReport;
  onRetry?: () => void;
  retrying?: boolean;
  retryError?: string;
}) {
  const limited = report.view === "LIMITED_REPORT";
  const confidence = limited ? report.automatic.evidenceConfidence : report.evidenceConfidence;
  const score = limited ? null : report.hybridScore;
  const matchedCount = report.automatic.matchedRequirements.filter((item) => item.matched).length;
  const totalCount = report.automatic.matchedRequirements.length;
  const summary = limited
    ? "Automatic matching completed successfully. The AI evaluation failed, so no hybrid final score is calculated."
    : report.summary;
  const mainGap = limited ? "Retry AI to produce the approved 60/40 hybrid score." : report.aiEvaluation.mainGap;

  return (
    <main className="private-match-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> {report.job.title} <span>/</span> Match report
      </div>
      <div className="private-match-report-actions">
        <div>
          <h1>{limited ? "Private CV match report — limited mode" : "Private CV match report"}</h1>
          <p>{report.job.title} at {report.job.company}{limited ? " · AI temporarily unavailable" : ""}</p>
        </div>
        <div className="private-match-action-buttons">
          {limited ? (
            <button className="private-match-secondary-button" type="button" onClick={onRetry} disabled={retrying}>
              <RefreshCw aria-hidden="true" className={retrying ? "private-match-spin" : ""} /> {retrying ? "Retrying…" : "Retry AI"}
            </button>
          ) : null}
          {report.canApply ? (
            <Link className="private-match-primary-button" href={applyHref(report)}>
              <Send aria-hidden="true" /> Apply now
            </Link>
          ) : (
            <button className="private-match-primary-button" type="button" disabled title="This job is no longer accepting applications.">
              <Send aria-hidden="true" /> Apply now
            </button>
          )}
        </div>
      </div>
      {retryError ? <p className="private-match-inline-error" role="alert">{retryError}</p> : null}

      <section className={`private-match-report-header ${limited ? "is-limited" : ""}`}>
        <div className="private-match-report-score">
          <span>{limited ? "DETERMINISTIC MATCH" : "PRIVATE MATCH SCORE"}</span>
          <strong>{limited ? number(report.automatic.score) : number(score ?? 0)}<small>/100</small></strong>
          <b>{bandLabel(report)}</b>
          <span className="private-match-badge">
            {limited ? "Reduced-capability preview" : "Independent candidate preview"}
          </span>
        </div>
        <div className="private-match-report-summary">
          <h2>{limited ? "You can still review rule-based matches" : reportHeadline(report)}</h2>
          <p>{summary}</p>
          {mainGap ? <p>{mainGap}</p> : null}
          <small>Same CV + same job version + same method = the same underlying score.</small>
        </div>
        <div className="private-match-confidence-card">
          <h3><Gauge aria-hidden="true" /> Evidence confidence</h3>
          <Progress value={confidence} label="Evidence confidence" />
          <strong>{confidence}% — {confidenceLabel(confidence)}</strong>
          <p>Based on clear, recent evidence.</p>
        </div>
      </section>

      <div className="private-match-metric-grid">
        <MetricCard icon={<ListChecks aria-hidden="true" />} title="Automatic matching" score={`${number(report.automatic.score)}/100`} meta="Weight 60%" progress={report.automatic.score} caption={limited ? "Available deterministic component" : `Weighted contribution: ${number(report.automatic.weightedContribution)}`} />
        <MetricCard icon={<BriefcaseBusiness aria-hidden="true" />} title="AI evaluation" score={limited ? "—" : `${number(report.aiEvaluation.score)}/100`} meta="Weight 40%" progress={limited ? null : report.aiEvaluation.score} caption={limited ? "AI contribution unavailable" : `Weighted contribution: ${number(report.aiEvaluation.weightedContribution)}`} unavailable={limited} />
        <MetricCard icon={<FileSearch aria-hidden="true" />} title="Evidence coverage" score={`${number(report.automatic.evidenceCoverage)}%`} meta="Quality signal" progress={report.automatic.evidenceCoverage} caption={`Clear evidence for ${matchedCount} of ${totalCount} checks`} />
        <MetricCard icon={<ShieldCheck aria-hidden="true" />} title="Evidence confidence" score={String(confidence)} meta={confidenceLabel(confidence).replace(" confidence", "")} progress={confidence} caption="Confidence is not part of the score" />
      </div>

      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section className="private-match-card">
            <h2><BadgeCheck aria-hidden="true" /> Matched requirements</h2>
            <p className="private-match-report-note">{matchedCount ? "Strong evidence was found for these job requirements." : "No strong evidence was found for the listed job requirements."}</p>
            <div className="private-match-chip-group private-match-chip-group--report">
              {report.automatic.matchedRequirements.map((item) => <RequirementChip item={item} key={item.id} />)}
            </div>
            <div className="private-match-experience">
              <span><CalendarDays aria-hidden="true" /> Required: <strong>{report.automatic.requiredExperience === null ? "Not specified" : `${report.automatic.requiredExperience} years`}</strong></span>
              <span>Detected: <strong>{report.automatic.detectedExperience === null ? "Not specified" : `${report.automatic.detectedExperience} years`}</strong></span>
              {report.automatic.requiredExperience !== null && report.automatic.detectedExperience !== null && report.automatic.detectedExperience > report.automatic.requiredExperience ? <small>Exceeds requirement by {report.automatic.detectedExperience - report.automatic.requiredExperience} year(s)</small> : null}
            </div>
          </section>
          <section className="private-match-card">
            <h2><TriangleAlert aria-hidden="true" /> Gaps to address or verify</h2>
            {report.automatic.gaps.length ? (
              <ul className="private-match-gap-list">
                {report.automatic.gaps.map((gap) => (
                  <li className={gapClassName(gap.kind)} key={gap.code}>
                    <CircleAlert aria-hidden="true" />
                    <div><strong>{gap.title}</strong><p>{gap.description}</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="private-match-empty-copy">No gaps were identified in the deterministic comparison.</p>}
          </section>
          <section className="private-match-card">
            <h2><FileSearch aria-hidden="true" /> Evidence found in your CV</h2>
            {report.automatic.evidence.length ? (
              <ul className="private-match-evidence-list">
                {report.automatic.evidence.map((item, index) => (
                  <li key={`${item.criterion}-${index}`}>
                    <span>{evidenceTypeLabel(item.type)}</span>
                    <blockquote>“{item.quote}”</blockquote>
                    <small>{item.criterion} · {item.location}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="private-match-empty-copy">No bounded evidence quotes are available.</p>}
          </section>
        </div>

        <aside className="private-match-sidebar">
          <section className="private-match-card">
            <h2><Sparkles aria-hidden="true" /> Before you apply</h2>
            {limited ? (
              <p className="private-match-empty-copy"><strong>—</strong> AI improvement guidance is unavailable. Retry AI to receive prioritized, explainable actions.</p>
            ) : (
              <ol className="private-match-action-list">
                {report.actions.slice(0, 3).map((action, index) => <li key={`${action}-${index}`}><span>{index + 1}</span><p>{action}</p></li>)}
              </ol>
            )}
          </section>
          <section className="private-match-calc-card">
            {limited ? (
              <>
                <h2>Hybrid score unavailable</h2>
                <p>{number(report.automatic.score)} × 60% + AI × 40%</p>
                <strong>Final score: not calculated</strong>
                <small>Deterministic evidence remains available.</small>
              </>
            ) : (
              <>
                <h2>How {number(score ?? 0)} was calculated</h2>
                <p>{number(report.automatic.score)} × 60% + {number(report.aiEvaluation.score)} × 40%</p>
                <strong>= {number(score ?? 0)} /100</strong>
                <small>JD v{report.provenance.jdVersion} · CV v{report.provenance.cvVersion} · Config {report.provenance.scoringConfigVersion}</small>
              </>
            )}
          </section>
          <section className="private-match-privacy-card">
            <div className="private-match-card-heading">
              <ShieldCheck aria-hidden="true" />
              <div>
                <h2>Private self-assessment</h2>
                <p>{limited ? "This limited report is visible only to you. Retrying AI does not submit an application or affect recruiter ranking." : "This report is visible only to you. It is not included in your application and will not change a recruiter's ranking."}</p>
                <p>Sensitive attributes are excluded · You can delete this preview.</p>
              </div>
            </div>
            <PrivateMatchDeleteControl checkId={checkId} />
          </section>
        </aside>
      </div>
    </main>
  );
}
