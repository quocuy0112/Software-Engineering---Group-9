"use client";

import {
  BadgeCheck,
  ChartNoAxesColumn,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LockKeyhole,
  List,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type {
  FullPrivateReport,
  LimitedPrivateReport,
} from "@/shared/contracts/private-cv-match";
import {
  PrivateMatchAnalysisSteps,
  PrivateMatchPrivacyCard,
  PrivateMatchSelectedJobCard,
  PrivateMatchStatusBadge,
} from "./private-match-shared";

function duration(report: FullPrivateReport | LimitedPrivateReport) {
  const seconds =
    (new Date(report.completedAt).getTime() -
      new Date(report.createdAt).getTime()) /
    1_000;
  return Math.max(0, Math.round(seconds * 10) / 10);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function previewBand(report: FullPrivateReport | LimitedPrivateReport) {
  if (report.view === "LIMITED_REPORT") return "AI evaluation unavailable";
  if (report.matchBand === "HIGH_MATCH") return "Strong potential match";
  if (report.matchBand === "MEDIUM_MATCH") return "Good potential match";
  return "May need more evidence";
}

function headline(report: FullPrivateReport | LimitedPrivateReport) {
  if (report.view === "LIMITED_REPORT")
    return "Your rule-based match preview is ready";
  if (report.matchBand === "HIGH_MATCH")
    return "Your CV shows strong potential for this role";
  if (report.matchBand === "MEDIUM_MATCH")
    return "Your CV shows a reasonable fit for this role";
  return "Your CV may need more evidence for this role";
}

export function PrivateMatchReady({
  report,
  onOpen,
}: {
  report: FullPrivateReport | LimitedPrivateReport;
  onOpen: () => void;
}) {
  const limited = report.view === "LIMITED_REPORT";
  const score = limited ? report.automatic.score : report.hybridScore;
  const caution = limited || report.matchBand === "LOW_MATCH";
  return (
    <main className="private-match-page private-match-ready-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> Analysis
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>Your match report is ready</h1>
          <p>
            The analysis finished in {duration(report)}s. Review the result
            before you apply.
          </p>
        </div>
        <PrivateMatchStatusBadge state="completed" />
      </div>
      <section
        className={`private-match-ready-banner ${limited ? "is-limited" : ""} ${caution ? "is-caution" : ""}`}
      >
        <div className="private-match-ready-copy">
          <div className="private-match-hero-icon">
            {caution ? (
              <TriangleAlert aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
          </div>
          <div className="private-match-ready-body">
            <span
              className={`private-match-ready-status ${limited ? "private-match-ready-status--warning" : ""}`}
            >
              {limited ? (
                <TriangleAlert aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {limited ? "Reduced-capability preview" : "Analysis complete"}
            </span>
            <h2>{headline(report)}</h2>
            <p>
              {limited
                ? "Automatic matching completed successfully. The AI evaluation failed, so no hybrid final score is calculated."
                : "SmartHire compared your CV evidence with the job requirements. Open the report to see matched skills, gaps and practical improvements."}
            </p>
            <span className="private-match-private-line">
              <LockKeyhole aria-hidden="true" /> Private preview • Not shared
              with the employer
            </span>
          </div>
        </div>
        <div className="private-match-preview-score">
          <div className="private-match-score-label">
            {limited ? "DETERMINISTIC MATCH" : "PREVIEW MATCH SCORE"}
          </div>
          <div className="private-match-score-value">{score}</div>
          <div className="private-match-score-out">out of 100</div>
          <div
            className={`private-match-score-tag ${caution ? "private-match-score-tag--caution" : ""}`}
          >
            {previewBand(report)}
          </div>
        </div>
      </section>

      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section className="private-match-card">
            <h2>Analysis progress</h2>
            <p className="private-match-section-intro">
              Each stage completed successfully.
            </p>
            <PrivateMatchAnalysisSteps />
          </section>
          <section className="private-match-card">
            <h2>Sources used for this report</h2>
            <div className="private-match-source-row">
              <span className="private-match-source-icon">
                <FileText aria-hidden="true" />
              </span>
              <div>
                <strong>{report.cv.fileName}</strong>
                <p>
                  Parsed successfully • Updated {date(report.cv.confirmedAt)}
                </p>
              </div>
              <span className="private-match-badge private-match-badge--green">
                <BadgeCheck aria-hidden="true" /> Ready
              </span>
            </div>
            <div className="private-match-source-row">
              <span className="private-match-source-icon">
                <BriefcaseBusiness aria-hidden="true" />
              </span>
              <div>
                <strong>{report.job.title}</strong>
                <p>
                  {report.job.company} • Job description version{" "}
                  {report.job.jdVersion}
                </p>
              </div>
              <span className="private-match-badge private-match-badge--blue">
                <CheckCircle2 aria-hidden="true" />
                Current JD
              </span>
            </div>
          </section>
          <section className="private-match-guidance-banner">
            <span className="private-match-guidance-icon">
              <ShieldCheck aria-hidden="true" />
            </span>
            <div>
              <strong>This is guidance, not a hiring decision</strong>
              <p>
                This private preview uses the approved 60/40 method. A later
                employer result changes only when the submitted CV or job
                version changes.
              </p>
            </div>
          </section>
        </div>
        <aside className="private-match-sidebar">
          <PrivateMatchSelectedJobCard job={report.job} />
          <PrivateMatchPrivacyCard />
          <section className="private-match-card">
            <h2>Inside your report</h2>
            <ul className="private-match-preview-list">
              <li>
                <span className="private-match-inside-icon">
                  <List aria-hidden="true" />
                </span>
                <div>
                  <strong>Requirement evidence</strong>
                  <span>See what matched and what is missing.</span>
                </div>
              </li>
              <li>
                <span className="private-match-inside-icon">
                  <ChartNoAxesColumn aria-hidden="true" />
                </span>
                <div>
                  <strong>Explainable score</strong>
                  <span>Review categories, weights and formula.</span>
                </div>
              </li>
              <li>
                <span className="private-match-inside-icon">
                  <Sparkles aria-hidden="true" />
                </span>
                <div>
                  <strong>Improvement plan</strong>
                  <span>Get focused actions before applying.</span>
                </div>
              </li>
            </ul>
          </section>
          <button
            className="private-match-primary-button private-match-primary-button--wide"
            type="button"
            onClick={onOpen}
          >
            <Sparkles aria-hidden="true" /> View full match report
          </button>
          {limited ? (
            <p className="private-match-inline-note">
              <TriangleAlert aria-hidden="true" /> The report will open in
              limited mode.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
