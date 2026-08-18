"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";
import {
  privateMatchErrorMessage,
  useCreatePrivateCvMatch,
} from "../client/use-private-cv-match";
import {
  formatEmploymentType,
  formatExperienceRequirement,
  formatWorkArrangement,
  PrivateMatchStepper,
} from "./private-match-shared";

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
  const requestedCvIsUnavailable = Boolean(
    initialCvId && !cvs.some((cv) => cv.id === initialCvId),
  );
  const selectedJobId = initialJobId ?? jobs[0]?.jobId ?? "";
  const selectedCvId =
    initialCvId ??
    cvs.find((cv) => cv.parseStatus === "READY")?.id ??
    cvs[0]?.id ??
    "";
  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === selectedJobId),
    [jobs, selectedJobId],
  );
  const selectedCv = useMemo(
    () => cvs.find((cv) => cv.id === selectedCvId),
    [cvs, selectedCvId],
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

  if (requestedCvIsUnavailable) {
    return (
      <main
        className="private-match-page private-match-empty"
        aria-live="polite"
      >
        <TriangleAlert aria-hidden="true" />
        <h1>This CV version is no longer available for a private check.</h1>
        <p>
          Choose another CV from your CV library and return when it is ready.
          Your CV has not been changed.
        </p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/profile/cv-imports")}
        >
          Choose another CV
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
    <main className="private-match-page private-match-setup-page">
      <div className="private-match-breadcrumb">
        CV Match Check <span>/</span> New assessment
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>Check how well your CV fits a job</h1>
          <p>Get a private, explainable match preview before you apply.</p>
        </div>
      </div>
      <div className="private-match-stepper-card">
        <PrivateMatchStepper activeStep={1} />
      </div>

      <div className="private-match-columns">
        <div className="private-match-main-column">
          <section
            className="private-match-card private-match-job-card"
            aria-labelledby="target-job-title"
          >
            <div className="private-match-card-topline">
              <h2
                id="target-job-title"
                className="private-match-card-topline-heading"
              >
                Target job description
              </h2>
              <span className="private-match-card-topline-caption">
                Current job
              </span>
            </div>
            <div className="private-match-job-panel private-match-setup-info-row">
              <span className="private-match-large-icon">
                <BriefcaseBusiness aria-hidden="true" />
              </span>
              <div className="private-match-info-body">
                <h3>{selectedJob.title}</h3>
                <span>
                  {selectedJob.company} {"\u00b7"} {selectedJob.location}{" "}
                  {"\u00b7"}{" "}
                  {formatWorkArrangement(selectedJob.workArrangement)}
                </span>
                <small>
                  {formatEmploymentType(selectedJob.employmentType)} {"\u00b7"}{" "}
                  {formatExperienceRequirement(
                    selectedJob.requiredExperienceYears,
                  )}{" "}
                  {"\u00b7"} Source: SmartHire job post
                </small>
              </div>
              <span className="private-match-badge private-match-badge--green">
                <Check aria-hidden="true" /> Selected
              </span>
            </div>
            <p
              id="key-requirements-found"
              className="private-match-requirements-label"
            >
              Key requirements found
            </p>
            <div
              className="private-match-chip-group"
              aria-labelledby="key-requirements-found"
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
              <h2
                id="cv-assess-title"
                className="private-match-card-topline-heading"
              >
                CV to assess
              </h2>
              <span className="private-match-card-topline-caption">
                Current CV
              </span>
            </div>
            <div className="private-match-card-heading private-match-setup-info-row private-match-setup-info-row--neutral">
              <span className="private-match-large-icon">
                <FileText aria-hidden="true" />
              </span>
              <div className="private-match-info-body">
                <h3>{selectedCv.fileName}</h3>
                <span>
                  {selectedCv.pageCount
                    ? `${selectedCv.pageCount} pages`
                    : "Page count unavailable"}{" "}
                  {"\u00b7"} {bytes(selectedCv.byteSize)} {"\u00b7"}{" "}
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
                {ready ? <Check aria-hidden="true" /> : null}
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
            <ul
              className="private-match-check-grid"
              aria-label="Assessment comparison areas"
            >
              {[
                "Required skills and tools",
                "Evidence quality in the CV",
                "Years and level of experience",
                "Preferred skills and context",
              ].map((label) => (
                <li key={label}>
                  <span className="private-match-check-mark" aria-hidden="true">
                    <Check />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="private-match-privacy-card"
            aria-labelledby="private-self-assessment-title"
          >
            <div className="private-match-private-box">
              <div className="private-match-private-heading">
                <LockKeyhole aria-hidden="true" />
                <h2 id="private-self-assessment-title">
                  Private self-assessment
                </h2>
              </div>
              <p>
                This private result uses the approved 60/40 method. It is not
                sent to recruiters and does not affect your application.
              </p>
              <div className="private-match-inset">
                <ShieldCheck aria-hidden="true" />
                <span>
                  Sensitive personal attributes are excluded. Delete saved
                  previews anytime from CV Match Check.
                </span>
              </div>
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
              <IconRow icon={<Clock3 aria-hidden="true" />}>
                Overall CV-to-job match score
              </IconRow>
              <IconRow icon={<AlignLeft aria-hidden="true" />}>
                Skill and experience breakdown
              </IconRow>
              <IconRow icon={<Search aria-hidden="true" />}>
                Evidence linked to CV sections
              </IconRow>
              <IconRow icon={<Star aria-hidden="true" />}>
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
            className="private-match-primary-button private-match-primary-button--wide private-match-setup-cta"
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
