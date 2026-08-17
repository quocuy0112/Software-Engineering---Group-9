"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Check,
  FileSearch,
  FileText,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  privateMatchErrorMessage,
  useCreatePrivateCvMatch,
} from "../client/use-private-cv-match";
import { PrivateMatchStepper } from "./private-match-shared";

export type PrivateMatchSetupJob = Readonly<{
  jobId: string;
  slug: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  requiredExperienceYears: number | null;
  requirements: readonly string[];
}>;

export type PrivateMatchSetupCv = Readonly<{
  id: string;
  displayName: string;
  fileName: string;
  mimeType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  byteSize: number;
  version: number;
  confirmedAt: string;
  pageCount: number | null;
  parseStatus: "READY" | "PARTIAL" | "FAILED";
}>;

function bytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function IconRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="private-match-icon-row">
      <span className="private-match-icon-box">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export function PrivateMatchSetup({
  jobs,
  cvs,
  initialJobId,
  initialCvId,
}: {
  jobs: readonly PrivateMatchSetupJob[];
  cvs: readonly PrivateMatchSetupCv[];
  initialJobId?: string;
  initialCvId?: string;
}) {
  const router = useRouter();
  const create = useCreatePrivateCvMatch();
  const requestedJobIsUnavailable = Boolean(
    initialJobId && !jobs.some((job) => job.jobId === initialJobId),
  );
  const [jobId, setJobId] = useState(
    initialJobId && jobs.some((job) => job.jobId === initialJobId)
      ? initialJobId
      : initialJobId
        ? ""
        : (jobs[0]?.jobId ?? ""),
  );
  const [cvId, setCvId] = useState(
    initialCvId && cvs.some((cv) => cv.id === initialCvId)
      ? initialCvId
      : (cvs.find((cv) => cv.parseStatus === "READY")?.id ?? cvs[0]?.id ?? ""),
  );
  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === jobId),
    [jobs, jobId],
  );
  const selectedCv = useMemo(
    () => cvs.find((cv) => cv.id === cvId) ?? cvs[0],
    [cvs, cvId],
  );
  const ready = selectedCv?.parseStatus === "READY";

  async function analyze() {
    if (!selectedJob || !selectedCv || !ready) return;
    try {
      const result = await create.mutateAsync({
        jobId: selectedJob.jobId,
        cvVersionId: selectedCv.id,
      });
      if (result.view === "STATUS") {
        router.push(`/cv-match-check/${encodeURIComponent(result.checkId)}`);
      }
    } catch {
      // The mapped error is rendered below without exposing server details.
    }
  }

  if (requestedJobIsUnavailable) {
    return (
      <main
        className="private-match-page private-match-empty"
        aria-live="polite"
      >
        <TriangleAlert aria-hidden="true" />
        <h1>This job is no longer available for a private check.</h1>
        <p>
          Choose another eligible job to start a private CV match check. Your CV
          has not been changed.
        </p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/cv-match-check/new")}
          disabled={!jobs.length}
        >
          Choose another job
        </button>
        <button
          className="private-match-secondary-button"
          type="button"
          onClick={() => router.push("/cv-match-check")}
        >
          Back to CV Match Check
        </button>
      </main>
    );
  }

  if (!selectedJob || !selectedCv) {
    return (
      <main
        className="private-match-page private-match-empty"
        aria-live="polite"
      >
        <TriangleAlert aria-hidden="true" />
        <h1>Check how well your CV fits a job</h1>
        <p>Add a confirmed CV and return when an eligible job is available.</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/cv-match-check")}
        >
          Back to CV Match Check
        </button>
      </main>
    );
  }

  return (
    <main className="private-match-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> New assessment
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>Check how well your CV fits a job</h1>
          <p>Get a private, explainable match preview before you apply.</p>
        </div>
      </div>
      <PrivateMatchStepper activeStep={1} />

      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section
            className="private-match-card private-match-job-card"
            aria-labelledby="target-job-title"
          >
            <div className="private-match-card-topline">
              <div className="private-match-card-label">Current job</div>
              <label
                className="private-match-compact-select"
                htmlFor="private-match-job"
              >
                <span className="private-match-visually-hidden">
                  Job to assess
                </span>
                <select
                  id="private-match-job"
                  className="private-match-select"
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                >
                  {jobs.map((job) => (
                    <option key={job.jobId} value={job.jobId}>
                      {job.title} · {job.company}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h2 id="target-job-title">Target job description</h2>
            <div className="private-match-job-panel">
              <span className="private-match-large-icon">
                <BriefcaseBusiness aria-hidden="true" />
              </span>
              <div>
                <h3>{selectedJob.title}</h3>
                <span>
                  {selectedJob.company} · {selectedJob.location} ·{" "}
                  {selectedJob.workArrangement}
                </span>
                <small>
                  {selectedJob.employmentType}
                  {selectedJob.requiredExperienceYears === null
                    ? ""
                    : ` · ${selectedJob.requiredExperienceYears}+ years`}{" "}
                  · Source: SmartHire job post
                </small>
              </div>
              <span className="private-match-badge private-match-badge--green">
                <Check aria-hidden="true" /> Selected
              </span>
            </div>
            <div
              className="private-match-chip-group"
              aria-label="Key requirements found"
            >
              {selectedJob.requirements.slice(0, 8).map((requirement) => (
                <span className="private-match-chip" key={requirement}>
                  {requirement}
                </span>
              ))}
            </div>
          </section>

          <section
            className="private-match-card"
            aria-labelledby="cv-assess-title"
          >
            <div className="private-match-card-topline">
              <div className="private-match-card-label">Current CV</div>
              <label
                className="private-match-compact-select"
                htmlFor="private-match-cv"
              >
                <span className="private-match-visually-hidden">
                  CV version to assess
                </span>
                <select
                  id="private-match-cv"
                  className="private-match-select"
                  value={cvId}
                  onChange={(event) => setCvId(event.target.value)}
                >
                  {cvs.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.displayName} · v{cv.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="private-match-card-heading">
              <span className="private-match-large-icon">
                <FileText aria-hidden="true" />
              </span>
              <div>
                <h2 id="cv-assess-title">CV to assess</h2>
                <p>{selectedCv.fileName}</p>
                <span>
                  {selectedCv.pageCount
                    ? `${selectedCv.pageCount} pages`
                    : "Page count unavailable"}{" "}
                  · {bytes(selectedCv.byteSize)} ·{" "}
                  {ready ? "Parsed successfully" : "Parsing in progress"}
                </span>
              </div>
              <span
                className={`private-match-badge ${
                  ready
                    ? "private-match-badge--green"
                    : "private-match-badge--yellow"
                }`}
              >
                {ready ? "Ready" : "Not ready"}
              </span>
            </div>
            <p className="private-match-caption">
              The assessment uses this CV version only. Your profile data is not
              changed.
            </p>
          </section>

          <section
            className="private-match-card"
            aria-labelledby="compare-title"
          >
            <h2 id="compare-title">What the assessment will compare</h2>
            <div className="private-match-check-grid">
              {[
                "Required skills and tools",
                "Evidence quality in the CV",
                "Years and level of experience",
                "Preferred skills and context",
              ].map((label) => (
                <label key={label}>
                  <input type="checkbox" checked readOnly />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section
            className="private-match-privacy-card"
            aria-label="Private self-assessment"
          >
            <div className="private-match-card-heading">
              <LockKeyhole aria-hidden="true" />
              <div>
                <h2>Private self-assessment</h2>
                <p>
                  This private result uses the approved 60/40 method. It is not
                  sent to recruiters and does not affect your application.
                </p>
              </div>
            </div>
            <div className="private-match-inset">
              <ShieldCheck aria-hidden="true" />
              <span>
                Sensitive personal attributes are excluded. Delete saved
                previews anytime from CV Match Check.
              </span>
            </div>
          </section>

          {create.isError ? (
            <div className="private-match-inline-error" role="alert">
              {privateMatchErrorMessage(create.error)}
            </div>
          ) : null}
        </div>

        <aside className="private-match-sidebar">
          <section className="private-match-card">
            <h2>Your report will include</h2>
            <ul className="private-match-icon-list">
              <IconRow icon={<Gauge aria-hidden="true" />}>
                Overall CV-to-job match score
              </IconRow>
              <IconRow icon={<BriefcaseBusiness aria-hidden="true" />}>
                Skill and experience breakdown
              </IconRow>
              <IconRow icon={<FileSearch aria-hidden="true" />}>
                Evidence linked to CV sections
              </IconRow>
              <IconRow icon={<Sparkles aria-hidden="true" />}>
                Practical improvement suggestions
              </IconRow>
            </ul>
          </section>
          <section className="private-match-card">
            <h2>How it works</h2>
            <ol className="private-match-number-list">
              <li>
                <span>1</span>
                <div>
                  <strong>Read the job requirements</strong>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Find supporting evidence in your CV</strong>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Calculate an explainable match score</strong>
                </div>
              </li>
            </ol>
          </section>
          <section className="private-match-limit-card">
            <TriangleAlert aria-hidden="true" />
            <div>
              <h2>Important limitation</h2>
              <p>
                The score estimates document fit only. It cannot measure
                teamwork, motivation, interview performance, or final hiring
                potential.
              </p>
              <p className="private-match-muted">
                Recruiters may use different criteria and weights.
              </p>
            </div>
          </section>
          <button
            className="private-match-primary-button private-match-primary-button--wide"
            type="button"
            onClick={() => void analyze()}
            disabled={!ready || create.isPending}
          >
            {create.isPending ? (
              <span className="private-match-spinner" aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {create.isPending ? "Analyzing…" : "Analyze my CV"}
          </button>
        </aside>
      </div>
    </main>
  );
}
