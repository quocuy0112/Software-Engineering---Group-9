"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { privateMatchCopy } from "../i18n/private-match-copy";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { candidateCvSummarySchema } from "@/shared/contracts/cv-import/candidate-cv";
import {
  CvFileValidationError,
  validateCvFile,
} from "@/shared/cv-file-validation";
import {
  PRIVATE_MATCH_JOB_PICKER_LIMIT,
  privateMatchJobsResponseSchema,
} from "@/shared/contracts/private-cv-match";
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
    | "application/msword"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  byteSize: number;
  version: number;
  confirmedAt: string;
  pageCount: number | null;
  parseStatus: "READY" | "PARTIAL" | "FAILED";
}>;

type JobPickerSearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string }
  | { status: "empty"; query: string }
  | { status: "error"; query: string };

function bytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function validateLocalCv(
  file: File,
  locale: "vi" | "en",
  fallback: string,
): Promise<string | null> {
  try {
    await validateCvFile(file);
    return null;
  } catch (error) {
    return locale === "en" && error instanceof CvFileValidationError
      ? error.message
      : fallback;
  }
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
  const locale = useWorkspaceLocale();
  const copy = privateMatchCopy(locale);
  const setup = copy.setup;
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
  const [jobSearchState, setJobSearchState] = useState<JobPickerSearchState>({
    status: "idle",
  });
  const [jobSearchRetry, setJobSearchRetry] = useState(0);
  const jobSearchRequest = useRef(0);
  const jobSearchAbort = useRef<AbortController | null>(null);
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
    jobSearchAbort.current?.abort();
    const request = ++jobSearchRequest.current;
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJobSearchState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    jobSearchAbort.current = controller;
    setJobSearchState({ status: "loading", query });
    const timer = window.setTimeout(() => {
      void fetch(
        `/api/candidate/private-cv-matches/jobs?q=${encodeURIComponent(query)}&searchBy=BOTH&limit=${PRIVATE_MATCH_JOB_PICKER_LIMIT}`,
        {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("JOB_SEARCH_FAILED");
          return privateMatchJobsResponseSchema.parse(await response.json());
        })
        .then((result) => {
          if (request !== jobSearchRequest.current) return;
          setRemoteJobs(result.items);
          setJobSearchState(
            result.items.length
              ? { status: "success", query }
              : { status: "empty", query },
          );
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            request !== jobSearchRequest.current ||
            (error instanceof DOMException && error.name === "AbortError")
          )
            return;
          setJobSearchState({ status: "error", query });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [jobSearch, jobSearchRetry]);

  const matchingJobs = useMemo(
    () => (jobSearch.trim() ? remoteJobs : jobs),
    [jobSearch, jobs, remoteJobs],
  );
  const isJobSearchLoading = jobSearchState.status === "loading";
  const ready = selectedCv?.parseStatus === "READY";

  function showLocalCvError(message: string) {
    setLocalUploadError(message);
    toast.error(message, { id: "candidate-cv-upload-error" });
  }

  useEffect(() => {
    if (!create.isError) return;
    toast.error(privateMatchErrorMessage(create.error, locale), {
      id: "candidate-cv-upload-error",
    });
  }, [create.error, create.isError, locale]);

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
            ? locale === "en"
              ? (body as { message: string }).message
              : setup.importFailure
            : setup.importFailure;
        throw new Error(message);
      }
      const saved = candidateCvSummarySchema.parse(body);
      const mimeType = saved.mimeType;
      if (
        mimeType !== "application/pdf" &&
        mimeType !== "application/msword" &&
        mimeType !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        throw new Error(setup.unsupportedFile);
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
      const message =
        error instanceof Error &&
        (locale === "en" || error.message === setup.unsupportedFile)
          ? error.message
          : setup.importFailure;
      setLocalFile(null);
      if (fileInput.current) fileInput.current.value = "";
      showLocalCvError(message);
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
        <h1>{setup.jobUnavailableTitle}</h1>
        <p>{setup.jobUnavailableDescription}</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/cv-match-check/new")}
          disabled={!jobs.length}
        >
          {setup.chooseAnotherJob}
        </button>
        <button
          className="private-match-secondary-button"
          type="button"
          onClick={() => router.push("/cv-match-check")}
        >
          {copy.common.backToCheck}
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
        <h1>{setup.cvUnavailableTitle}</h1>
        <p>{setup.cvUnavailableDescription}</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/profile/cv-imports")}
        >
          {setup.chooseAnotherCv}
        </button>
        <button
          className="private-match-secondary-button"
          type="button"
          onClick={() => router.push("/cv-match-check")}
        >
          {copy.common.backToCheck}
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
        <h1>{setup.emptyTitle}</h1>
        <p>{setup.emptyDescription}</p>
        <button
          className="private-match-primary-button"
          type="button"
          onClick={() => router.push("/cv-match-check")}
        >
          {copy.common.backToCheck}
        </button>
      </main>
    );
  }

  return (
    <main className="private-match-page private-match-setup-page">
      <div className="private-match-breadcrumb">
        {copy.common.cvMatchCheck} <span>/</span> {setup.newAssessment}
      </div>
      <div className="private-match-title-row">
        <div>
          <h1>{setup.heading}</h1>
          <p>{setup.subtitle}</p>
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
                {setup.targetJob}
              </h2>
              <span className="private-match-card-topline-caption">
                {setup.currentJob}
              </span>
            </div>
            <div className="private-match-picker">
              <label htmlFor="private-match-job-search">{setup.findJob}</label>
              <input
                id="private-match-job-search"
                type="search"
                value={jobSearch}
                onChange={(event) => setJobSearch(event.currentTarget.value)}
                placeholder={setup.findJobPlaceholder}
                autoComplete="off"
              />
              <div
                className={`private-match-picker-results ${
                  matchingJobs.length > 6 ? "is-scrollable" : ""
                }`}
                aria-live="polite"
                aria-label={setup.matchingJobs}
              >
                {isJobSearchLoading ? (
                  <p className="private-match-picker-empty">
                    {setup.searchingJobs}
                  </p>
                ) : jobSearchState.status === "error" ? (
                  <div className="private-match-picker-empty" role="alert">
                    <strong>{setup.jobSearchErrorTitle}</strong>
                    <span>{setup.jobSearchErrorDescription}</span>
                    <button
                      className="private-match-secondary-button"
                      type="button"
                      onClick={() => setJobSearchRetry((value) => value + 1)}
                    >
                      {setup.retryJobSearch}
                    </button>
                  </div>
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
                    {setup.noMatchingJobs}
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
                  {formatWorkArrangement(selectedJob.workArrangement, locale)}
                </span>
                <small>
                  {formatEmploymentType(selectedJob.employmentType, locale)}{" "}
                  {"\u00b7"}{" "}
                  {formatExperienceRequirement(
                    selectedJob.requiredExperienceYears,
                    locale,
                  )}{" "}
                  {"\u00b7"} {setup.source}
                </small>
              </div>
              <span className="private-match-badge private-match-badge--green">
                <Check aria-hidden="true" /> {copy.common.selected}
              </span>
            </div>
            <p
              id="key-requirements-found"
              className="private-match-requirements-label"
            >
              {setup.keyRequirements}
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
                {setup.cvToAssess}
              </h2>
              <span className="private-match-card-topline-caption">
                {setup.currentCv}
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
                      ? setup.pages(selectedCv.pageCount)
                      : setup.pageCountUnavailable}{" "}
                    {"\u00b7"} {bytes(selectedCv.byteSize)} {"\u00b7"}{" "}
                    {ready ? setup.parsedSuccessfully : setup.parsingInProgress}
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
                  {ready ? copy.common.ready : setup.notReady}
                </span>
              </div>
            ) : (
              <div className="private-match-card-heading private-match-setup-info-row private-match-setup-info-row--neutral">
                <span className="private-match-large-icon">
                  <FileText aria-hidden="true" />
                </span>
                <div className="private-match-info-body">
                  <h3>{setup.noCvTitle}</h3>
                  <span>{setup.noCvDescription}</span>
                </div>
                <span className="private-match-badge private-match-badge--yellow">
                  {copy.common.required}
                </span>
              </div>
            )}
            <fieldset className="private-match-picker private-match-cv-picker">
              <legend>{setup.chooseProfileCv}</legend>
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
                          {cv.parseStatus === "READY"
                            ? copy.common.ready
                            : copy.common.processing}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="private-match-picker-empty">
                    {setup.noProfileCvs}
                  </p>
                )}
              </div>
            </fieldset>
            <div className="private-match-local-import">
              <div>
                <strong>{setup.importTitle}</strong>
                <p>{setup.importDescription}</p>
              </div>
              <input
                ref={fileInput}
                className="private-match-visually-hidden"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = event.currentTarget.files?.[0] ?? null;
                  setLocalUploadError(null);
                  setLocalUploadComplete(false);
                  void (async () => {
                    if (file) {
                      const errorMessage = await validateLocalCv(
                        file,
                        locale,
                        setup.invalidFile,
                      );
                      if (errorMessage) {
                        setLocalFile(null);
                        input.value = "";
                        showLocalCvError(errorMessage);
                        return;
                      }
                    }
                    setLocalFile(file);
                  })();
                }}
              />
              <div className="private-match-local-import-actions">
                <button
                  className="private-match-secondary-button"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={localUploadState === "UPLOADING"}
                >
                  <Upload aria-hidden="true" /> {setup.chooseLocalFile}
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
                      ? setup.uploading
                      : setup.importCv}
                  </button>
                ) : null}
              </div>
              {localUploadState === "UPLOADING" ? (
                <p role="status" aria-live="polite">
                  {setup.uploadingSecurely}
                </p>
              ) : null}
              {localUploadError ? <p role="alert">{localUploadError}</p> : null}
              {localUploadComplete ? (
                <p role="status">{setup.cvReady}</p>
              ) : null}
            </div>
            <p className="private-match-caption">{setup.cvVersionOnly}</p>
          </section>

          <section
            className="private-match-card"
            aria-labelledby="compare-title"
          >
            <h2 id="compare-title">{setup.compareTitle}</h2>
            <ul
              className="private-match-check-grid"
              aria-label={setup.comparisonAreas}
            >
              {setup.comparisons.map((label) => (
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
                  {copy.privacy.privateSelfAssessment}
                </h2>
              </div>
              <p>{setup.privacyDescription}</p>
              <div className="private-match-inset">
                <ShieldCheck aria-hidden="true" />
                <span>{setup.privacyNote}</span>
              </div>
            </div>
          </section>

          {create.isError ? (
            <div className="private-match-inline-error" role="alert">
              {privateMatchErrorMessage(create.error, locale)}
            </div>
          ) : null}
        </div>

        <aside className="private-match-sidebar">
          <section className="private-match-card">
            <h2>{setup.reportIncludes}</h2>
            <ul className="private-match-icon-list">
              <IconRow icon={<Clock3 aria-hidden="true" />}>
                {setup.reportItems[0]}
              </IconRow>
              <IconRow icon={<AlignLeft aria-hidden="true" />}>
                {setup.reportItems[1]}
              </IconRow>
              <IconRow icon={<Search aria-hidden="true" />}>
                {setup.reportItems[2]}
              </IconRow>
              <IconRow icon={<Star aria-hidden="true" />}>
                {setup.reportItems[3]}
              </IconRow>
            </ul>
          </section>
          <section className="private-match-card">
            <h2>{setup.howItWorks}</h2>
            <ol className="private-match-number-list">
              <li>
                <span>1</span>
                <div>
                  <strong>{setup.steps[0]}</strong>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>{setup.steps[1]}</strong>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>{setup.steps[2]}</strong>
                </div>
              </li>
            </ol>
          </section>
          <section className="private-match-limit-card">
            <TriangleAlert aria-hidden="true" />
            <div>
              <h2>{setup.limitationTitle}</h2>
              <p>{setup.limitationDescription}</p>
              <p className="private-match-muted">{setup.limitationNote}</p>
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
            {create.isPending ? setup.analyzing : setup.analyzeCv}
          </button>
        </aside>
      </div>
    </main>
  );
}
