"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  Upload,
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
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { CV_SOURCE_MAX_BYTES } from "@/shared/contracts/cv-import/common";
import { candidateCvSummarySchema } from "@/shared/contracts/cv-import/candidate-cv";
import { privateMatchJobsResponseSchema } from "@/shared/contracts/private-cv-match";
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

function canImportCv(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  const mimeType =
    extension === "pdf"
      ? "application/pdf"
      : extension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : file.type;
  return (
    file.size > 0 &&
    file.size <= CV_SOURCE_MAX_BYTES &&
    ((mimeType === "application/pdf" && extension === "pdf") ||
      (mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        extension === "docx"))
  );
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
  const csrfProof = useCsrfProof();
  const fileInput = useRef<HTMLInputElement>(null);
  const [availableCvs, setAvailableCvs] = useState<
    readonly PrivateMatchSetupCv[]
  >(() => cvs);
  const [selectedJobId, setSelectedJobId] = useState(
    () => initialJobId ?? jobs[0]?.jobId ?? "",
  );
  const [selectedCvId, setSelectedCvId] = useState(
    () =>
      initialCvId ??
      cvs.find((cv) => cv.parseStatus === "READY")?.id ??
      cvs[0]?.id ??
      "",
  );
  const [jobSearch, setJobSearch] = useState("");
  const [remoteJobs, setRemoteJobs] = useState<readonly PrivateMatchSetupJob[]>(
    [],
  );
  const [selectedRemoteJob, setSelectedRemoteJob] =
    useState<PrivateMatchSetupJob | null>(null);
  const [jobSearchLoading, setJobSearchLoading] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localUploadState, setLocalUploadState] = useState<
    "IDLE" | "UPLOADING"
  >("IDLE");
  const [localUploadError, setLocalUploadError] = useState<string | null>(null);
  const [localUploadComplete, setLocalUploadComplete] = useState(false);
  const requestedJobIsUnavailable = Boolean(
    initialJobId && !jobs.some((job) => job.jobId === initialJobId),
  );
  const requestedCvIsUnavailable = Boolean(
    initialCvId && !cvs.some((cv) => cv.id === initialCvId),
  );
  const selectedJob = useMemo(
    () =>
      jobs.find((job) => job.jobId === selectedJobId) ??
      remoteJobs.find((job) => job.jobId === selectedJobId) ??
      (selectedRemoteJob?.jobId === selectedJobId
        ? selectedRemoteJob
        : undefined),
    [jobs, remoteJobs, selectedJobId, selectedRemoteJob],
  );
  const selectedCv = useMemo(
    () => availableCvs.find((cv) => cv.id === selectedCvId),
    [availableCvs, selectedCvId],
  );
  useEffect(() => {
    const query = jobSearch.trim();
    if (!query) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setJobSearchLoading(true);
      void fetch(
        `/api/candidate/private-cv-matches/jobs?q=${encodeURIComponent(query)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("JOB_SEARCH_FAILED");
          return privateMatchJobsResponseSchema.parse(await response.json());
        })
        .then((result) => {
          if (cancelled) return;
          setRemoteJobs(result.items);
          setJobSearchLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setRemoteJobs([]);
          setJobSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [jobSearch]);

  const matchingJobs = useMemo(
    () => (jobSearch.trim() ? remoteJobs : jobs.slice(0, 6)),
    [jobSearch, jobs, remoteJobs],
  );
  const isJobSearchLoading = Boolean(jobSearch.trim()) && jobSearchLoading;
  const ready = selectedCv?.parseStatus === "READY";

  async function importLocalCv() {
    if (!localFile) return;
    setLocalUploadError(null);
    setLocalUploadComplete(false);
    setLocalUploadState("UPLOADING");
    try {
      const form = new FormData();
      form.append("file", localFile, localFile.name);
      const response = await mutateWithCurrentCsrf(
        "/api/account/candidate-cvs",
        { method: "POST", body: form },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          typeof (body as { message?: unknown }).message === "string"
            ? (body as { message: string }).message
            : "The CV could not be imported.";
        throw new Error(message);
      }
      const saved = candidateCvSummarySchema.parse(body);
      const mimeType = saved.mimeType;
      if (
        mimeType !== "application/pdf" &&
        mimeType !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        throw new Error("Only PDF and DOCX files can be assessed here.");
      }
      const nextCv: PrivateMatchSetupCv = {
        ...saved,
        mimeType,
        pageCount: null,
        parseStatus: "READY",
      };
      setAvailableCvs((current) =>
        [nextCv, ...current.filter((cv) => cv.id !== nextCv.id)].slice(0, 10),
      );
      setSelectedCvId(nextCv.id);
      setLocalUploadComplete(true);
    } catch (error) {
      setLocalUploadError(
        error instanceof Error
          ? error.message
          : "The CV could not be imported. Check the file and try again.",
      );
    } finally {
      setLocalUploadState("IDLE");
    }
  }

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

  if (!selectedJob) {
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
            <div className="private-match-picker">
              <label htmlFor="private-match-job-search">
                Find a job by keyword or company
              </label>
              <input
                id="private-match-job-search"
                type="search"
                value={jobSearch}
                onChange={(event) => setJobSearch(event.currentTarget.value)}
                placeholder="e.g. React, Product Designer, Acme"
                autoComplete="off"
              />
              <div
                className="private-match-picker-results"
                aria-live="polite"
                aria-label="Matching jobs"
              >
                {isJobSearchLoading ? (
                  <p className="private-match-picker-empty">
                    Searching eligible jobs…
                  </p>
                ) : matchingJobs.length ? (
                  matchingJobs.map((job) => (
                    <button
                      className={`private-match-picker-option ${
                        job.jobId === selectedJobId ? "is-selected" : ""
                      }`}
                      key={job.jobId}
                      type="button"
                      onClick={() => {
                        setSelectedJobId(job.jobId);
                        setSelectedRemoteJob(job);
                      }}
                    >
                      <strong>{job.title}</strong>
                      <span>{job.company}</span>
                    </button>
                  ))
                ) : (
                  <p className="private-match-picker-empty">
                    No eligible jobs match that keyword or company.
                  </p>
                )}
              </div>
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
            {selectedCv ? (
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
            ) : (
              <div className="private-match-card-heading private-match-setup-info-row private-match-setup-info-row--neutral">
                <span className="private-match-large-icon">
                  <FileText aria-hidden="true" />
                </span>
                <div className="private-match-info-body">
                  <h3>No CV selected yet</h3>
                  <span>
                    Choose a profile CV or import one from your device.
                  </span>
                </div>
                <span className="private-match-badge private-match-badge--yellow">
                  Required
                </span>
              </div>
            )}
            <fieldset className="private-match-picker private-match-cv-picker">
              <legend>Choose a CV from your profile</legend>
              <div className="private-match-picker-results">
                {availableCvs.length ? (
                  availableCvs.map((cv) => (
                    <label
                      className={`private-match-picker-option ${
                        cv.id === selectedCvId ? "is-selected" : ""
                      }`}
                      key={cv.id}
                    >
                      <input
                        type="radio"
                        name="private-match-cv"
                        checked={cv.id === selectedCvId}
                        onChange={() => setSelectedCvId(cv.id)}
                      />
                      <span>
                        <strong>{cv.displayName}</strong>
                        <small>
                          {bytes(cv.byteSize)} ·{" "}
                          {cv.parseStatus === "READY" ? "Ready" : "Processing"}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="private-match-picker-empty">
                    No profile CVs are available yet. You can import a local CV
                    below without updating your profile.
                  </p>
                )}
              </div>
            </fieldset>
            <div className="private-match-local-import">
              <div>
                <strong>Import a CV from your device</strong>
                <p>
                  PDF or DOCX, up to 5 MB. No skills or headline update is
                  required; the file is kept for this application.
                </p>
              </div>
              <input
                ref={fileInput}
                className="private-match-visually-hidden"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  setLocalUploadError(null);
                  setLocalUploadComplete(false);
                  if (file && !canImportCv(file)) {
                    setLocalFile(null);
                    setLocalUploadError(
                      "Choose a PDF or DOCX file up to 5 MB.",
                    );
                    return;
                  }
                  setLocalFile(file);
                }}
              />
              <div className="private-match-local-import-actions">
                <button
                  className="private-match-secondary-button"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={localUploadState === "UPLOADING"}
                >
                  <Upload aria-hidden="true" /> Choose local file
                </button>
                {localFile ? <span>{localFile.name}</span> : null}
                {localFile ? (
                  <button
                    className="private-match-secondary-button"
                    type="button"
                    onClick={() => void importLocalCv()}
                    disabled={localUploadState === "UPLOADING"}
                  >
                    {localUploadState === "UPLOADING"
                      ? "Uploading…"
                      : "Import CV"}
                  </button>
                ) : null}
              </div>
              {localUploadState === "UPLOADING" ? (
                <p role="status" aria-live="polite">
                  Uploading your CV securely…
                </p>
              ) : null}
              {localUploadError ? <p role="alert">{localUploadError}</p> : null}
              {localUploadComplete ? (
                <p role="status">
                  Your CV is ready and selected for this check. It will be
                  included for the recruiter when you submit the application.
                </p>
              ) : null}
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
