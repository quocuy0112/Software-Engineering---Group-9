"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  FileSearch,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Clock3,
} from "lucide-react";
import type { FullPrivateReport, LimitedPrivateReport } from "@/shared/contracts/private-cv-match";
import { PrivateMatchAnalysisSteps } from "./private-match-shared";

function duration(report: FullPrivateReport | LimitedPrivateReport) {
  const seconds =
    (new Date(report.completedAt).getTime() - new Date(report.createdAt).getTime()) /
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
  return "Low potential match";
}

function headline(report: FullPrivateReport | LimitedPrivateReport) {
  if (report.view === "LIMITED_REPORT") return "Your rule-based match preview is ready";
  if (report.matchBand === "HIGH_MATCH") return "Your CV shows strong potential for this role";
  if (report.matchBand === "MEDIUM_MATCH") return "Your CV shows a reasonable fit for this role";
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
  return (
    <main className="private-match-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> Analysis
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>Your match report is ready</h1>
          <p>
            The analysis finished in {duration(report)}s. Review the result before
            you apply.
          </p>
        </div>
        <span className="private-match-badge private-match-badge--blue">
          <Clock3 aria-hidden="true" /> Completed just now
        </span>
      </div>
      <section className={`private-match-ready-banner ${limited ? "is-limited" : ""}`}>
        <div className="private-match-ready-copy">
          {limited ? <TriangleAlert aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <div>
            <span className={`private-match-badge ${limited ? "private-match-badge--yellow" : "private-match-badge--green"}`}>
              {limited ? "Reduced-capability preview" : "Analysis complete"}
            </span>
            <h2>{headline(report)}</h2>
            <p>
              {limited
                ? "Automatic matching completed successfully. The AI evaluation failed, so no hybrid final score is calculated."
                : "SmartHire compared your CV evidence with the job requirements. Open the report to see matched skills, gaps and practical improvements."}
            </p>
            <span className="private-match-private-line">
              <LockKeyhole aria-hidden="true" /> Private preview · Not shared with the employer
            </span>
          </div>
        </div>
        <div className="private-match-preview-score">
          <span>{limited ? "DETERMINISTIC MATCH" : "PREVIEW MATCH SCORE"}</span>
          <strong>{score}<small>/100</small></strong>
          <b>{previewBand(report)}</b>
        </div>
      </section>

      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section className="private-match-card">
            <h2>Analysis progress</h2>
            <p className="private-match-section-intro">Each stage completed successfully.</p>
            <PrivateMatchAnalysisSteps />
          </section>
          <section className="private-match-card">
            <h2>Sources used for this report</h2>
            <div className="private-match-source-row">
              <FileText aria-hidden="true" />
              <div>
                <strong>{report.cv.fileName}</strong>
                <p>Parsed successfully · Updated {date(report.cv.confirmedAt)}</p>
              </div>
              <span className="private-match-badge private-match-badge--green">
                <BadgeCheck aria-hidden="true" /> Ready
              </span>
            </div>
            <div className="private-match-source-row">
              <BriefcaseIcon />
              <div>
                <strong>{report.job.title}</strong>
                <p>{report.job.company} · Job description version {report.job.jdVersion}</p>
              </div>
              <span className="private-match-badge private-match-badge--blue">Current JD</span>
            </div>
          </section>
          <section className="private-match-guidance-banner">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>This is guidance, not a hiring decision</strong>
              <p>
                This private preview uses the approved 60/40 method. A later
                employer result changes only when the submitted CV or job version
                changes.
              </p>
            </div>
          </section>
        </div>
        <aside className="private-match-sidebar">
          <section className="private-match-card">
            <div className="private-match-card-label">SELECTED JOB</div>
            <h2>{report.job.title}</h2>
            <p>{report.job.company} · {report.job.location}</p>
            <div className="private-match-chip-group">
              <span className="private-match-chip">{report.job.employmentType}</span>
              <span className="private-match-chip">
                {report.job.requiredExperienceYears === null
                  ? "Experience flexible"
                  : `${report.job.requiredExperienceYears}+ years`}
              </span>
            </div>
            <small className="private-match-sidebar-source">SmartHire job post · Version {report.job.jdVersion}</small>
          </section>
          <section className="private-match-card">
            <h2><LockKeyhole aria-hidden="true" /> Private and fair by design</h2>
            <ul className="private-match-check-list">
              <li><Check aria-hidden="true" />Only you can see this report.</li>
              <li><Check aria-hidden="true" />Sensitive personal attributes are excluded.</li>
              <li><Check aria-hidden="true" />The report is not sent to recruiters.</li>
            </ul>
          </section>
          <section className="private-match-card">
            <h2>Inside your report</h2>
            <ul className="private-match-preview-list">
              <li><FileSearch aria-hidden="true" /><div><strong>Requirement evidence</strong><span>See what your CV supports.</span></div></li>
              <li><GaugeIcon /><div><strong>Explainable score</strong><span>Review categories, weights and formula.</span></div></li>
              <li><Sparkles aria-hidden="true" /><div><strong>Improvement plan</strong><span>Get focused actions before applying.</span></div></li>
            </ul>
          </section>
          <button className="private-match-primary-button private-match-primary-button--wide" type="button" onClick={onOpen}>
            <Sparkles aria-hidden="true" /> View full match report
          </button>
          {limited ? <p className="private-match-inline-note"><TriangleAlert aria-hidden="true" /> The report will open in limited mode.</p> : null}
        </aside>
      </div>
    </main>
  );
}

function BriefcaseIcon() {
  return <span className="private-match-inline-icon" aria-hidden="true"><BriefcaseBusiness /></span>;
}

function GaugeIcon() {
  return <span className="private-match-inline-icon" aria-hidden="true">%</span>;
}
