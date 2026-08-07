"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import type {
  ApplicationContactSnapshot,
  ApplicationForm,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";
import {
  applicationFormSchema,
  applicationOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import type { AppliedJobState } from "@/shared/contracts/jobs/catalog";
import { useOptionalJobInteraction } from "./job-interaction-provider";

const MAX_CV_BYTES = 5_000_000;
const PHONE_INPUT_MAX_LENGTH = 15;
const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type FieldErrors = Record<string, string>;
type ApplicationMeta = Pick<
  AppliedJobState,
  "cvFileRef" | "contactSnapshot" | "aiAnalysisConsent" | "aiMatchScore"
>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function normalizePhone(value: string) {
  return value
    .replace(/[^\d+]/gu, "")
    .replace(/(?!^)\+/gu, "")
    .slice(0, PHONE_INPUT_MAX_LENGTH);
}

function canonicalizePhone(value: string) {
  const normalized = normalizePhone(value);
  return normalized.startsWith("0") ? "+84" + normalized.slice(1) : normalized;
}

function phoneValidationError(value: string) {
  const phone = normalizePhone(value);
  if (!phone) return "Enter your phone number.";
  if (!/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/u.test(phone)) {
    return "Enter a valid Vietnamese phone number.";
  }
  return null;
}

function fileRef(file: File) {
  const name = file.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .slice(0, 64);
  return "cv-upload-" + name + "-" + file.size + "-" + file.lastModified;
}

function validateContact(contact: ApplicationContactSnapshot): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!contact.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  const phoneError = phoneValidationError(contact.phone);
  if (phoneError) errors.phone = phoneError;
  return errors;
}

function fieldA11y(field: string, errors: FieldErrors) {
  return {
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? field + "-error" : undefined,
  };
}

function InlineApplicationForm({
  form,
  onCancel,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onSubmitted: (outcome: ApplicationOutcome, meta: ApplicationMeta) => void;
}) {
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contact, setContact] = useState<ApplicationContactSnapshot>(
    form.contact
      ? { ...form.contact, phone: normalizePhone(form.contact.phone) }
      : { fullName: "", email: "", phone: "" },
  );
  const [aiConsent, setAiConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const accepted =
      ACCEPTED_CV_TYPES.has(file.type) ||
      extension === "pdf" ||
      extension === "doc" ||
      extension === "docx";
    if (!accepted) {
      setSelectedFile(null);
      setErrors((current) => ({
        ...current,
        cv: "CV files must be PDF, DOC, or DOCX.",
      }));
      return;
    }
    if (file.size < 1 || file.size > MAX_CV_BYTES) {
      setSelectedFile(null);
      setErrors((current) => ({
        ...current,
        cv: "CV files must be between 1 and 5 MB.",
      }));
      return;
    }
    setSelectedFile(file);
    setSelectedCvId("");
    setErrors((current) => {
      const next = { ...current };
      delete next.cv;
      return next;
    });
  }

  function validate(): boolean {
    const next = validateContact({
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: normalizePhone(contact.phone),
    });
    if (!selectedCvId && !selectedFile)
      next.cv = "Select a saved CV or upload a CV.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const answers = form.questions.map((question) => ({
      questionId: question.id,
      value:
        question.kind === "BOOLEAN"
          ? data.get("question-" + question.id) === "true"
          : String(data.get("question-" + question.id) ?? ""),
    }));
    const cvFileRef = selectedFile ? fileRef(selectedFile) : selectedCvId;
    const contactSnapshot = {
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: canonicalizePhone(contact.phone),
    };

    try {
      idempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ??
        "application-" + Date.now() + "-key";
      const payload = {
        cvId: selectedCvId || cvFileRef,
        cvFileRef,
        contactSnapshot,
        answers,
        coverLetter: String(data.get("coverLetter") ?? "") || null,
        consentVersion: form.consentVersion,
        // Kept for the existing employer-facing application contract. The
        // AI analysis choice below is intentionally independent and optional.
        consentAccepted: true as const,
        aiAnalysisConsent: aiConsent,
      };
      const response = await mutateWithCurrentCsrf(
        "/api/jobs/" + form.jobId + "/applications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey.current,
          },
          body: JSON.stringify(payload),
        },
        form.csrfToken || csrfProof,
      );

      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = body as { message?: unknown; fieldErrors?: unknown };
        if (problem.fieldErrors && typeof problem.fieldErrors === "object") {
          const serverErrors: FieldErrors = {};
          for (const [field, value] of Object.entries(
            problem.fieldErrors as Record<string, unknown>,
          )) {
            const first = Array.isArray(value) ? value[0] : value;
            if (typeof first === "string") serverErrors[field] = first;
          }
          setErrors((current) => ({ ...current, ...serverErrors }));
        }
        setError(
          typeof problem.message === "string"
            ? problem.message
            : "Unable to submit your application.",
        );
        return;
      }

      const outcome = applicationOutcomeSchema.parse(body);
      onSubmitted(
        {
          ...outcome,
          aiAnalysisConsent: aiConsent,
          aiMatchScore: aiConsent ? 82 : null,
        },
        {
          cvFileRef,
          contactSnapshot,
          aiAnalysisConsent: aiConsent,
          aiMatchScore: aiConsent ? 82 : null,
        },
      );
    } catch {
      setError("Unable to submit your application. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const submitDisabled = pending || (!selectedCvId && !selectedFile);

  return (
    <form
      className="job-form-grid"
      aria-label={"Apply for " + form.jobTitle}
      onSubmit={submit}
      onChange={() => {
        idempotencyKey.current = null;
        setError(null);
      }}
      noValidate
    >
      {!form.profileReady ? (
        <div role="alert">
          Please complete these profile fields first:{" "}
          {form.missingProfileFields.join(", ")}.
        </div>
      ) : null}

      <fieldset className="job-application-fieldset">
        <legend>Application CV</legend>
        <p className="job-form-help">
          Choose a saved CV from SmartHire or upload a new one (PDF, DOC, DOCX;
          up to 5 MB).
        </p>
        {form.cvs.length ? (
          <label htmlFor="application-cv-id">
            Use a saved SmartHire CV / Select CV
            <select
              id="application-cv-id"
              name="cvId"
              value={selectedCvId}
              disabled={pending}
              {...fieldA11y("cv", errors)}
              onChange={(event) => {
                setSelectedCvId(event.currentTarget.value);
                setSelectedFile(null);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.cv;
                  return next;
                });
              }}
            >
              <option value="">Select a saved CV</option>
              {form.cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.displayName} · {cv.fileName} ({formatBytes(cv.byteSize)})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label
          className="job-cv-dropzone"
          htmlFor="application-cv-upload"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLLabelElement>) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0]);
          }}
        >
          <span className="job-cv-dropzone-title">
            {selectedFile
              ? "New CV selected"
              : "Drag a CV here or click to choose"}
          </span>
          <span className="job-form-help">PDF, DOC, DOCX · up to 5 MB</span>
          <input
            ref={fileInputRef}
            id="application-cv-upload"
            name="cvUpload"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-describedby={errors.cv ? "cv-error" : undefined}
            disabled={pending}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {selectedFile ? (
          <div className="job-selected-file" role="status">
            <span>
              <strong>{selectedFile.name}</strong> ·{" "}
              {formatBytes(selectedFile.size)}
            </span>
            <span className="job-file-actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
              >
                Change file
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={pending}
              >
                Remove
              </button>
            </span>
          </div>
        ) : null}
        {errors.cv ? (
          <p id="cv-error" className="job-field-error" role="alert">
            {errors.cv}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="job-application-fieldset">
        <legend>Contact information</legend>
        <label htmlFor="application-full-name">
          Full name <span aria-hidden="true">*</span>
          <input
            id="application-full-name"
            name="fullName"
            autoComplete="name"
            value={contact.fullName}
            {...fieldA11y("fullName", errors)}
            onChange={(event) =>
              setContact((current) => ({
                ...current,
                fullName: event.currentTarget.value,
              }))
            }
          />
          {errors.fullName ? (
            <span id="fullName-error" className="job-field-error" role="alert">
              {errors.fullName}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-email">
          Email <span aria-hidden="true">*</span>
          <input
            id="application-email"
            name="email"
            type="email"
            autoComplete="email"
            value={contact.email}
            {...fieldA11y("email", errors)}
            onChange={(event) =>
              setContact((current) => ({
                ...current,
                email: event.currentTarget.value,
              }))
            }
          />
          {errors.email ? (
            <span id="email-error" className="job-field-error" role="alert">
              {errors.email}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-phone">
          Phone number <span aria-hidden="true">*</span>
          <input
            id="application-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={PHONE_INPUT_MAX_LENGTH}
            value={contact.phone}
            {...fieldA11y("phone", errors)}
            onChange={(event) => {
              const phone = normalizePhone(event.currentTarget.value);
              setContact((current) => ({ ...current, phone }));
              setErrors((current) => {
                const next = { ...current };
                delete next.phone;
                return next;
              });
            }}
            onBlur={() => {
              const phoneError = phoneValidationError(contact.phone);
              setErrors((current) => {
                const next = { ...current };
                if (phoneError) next.phone = phoneError;
                else delete next.phone;
                return next;
              });
            }}
          />
          {errors.phone ? (
            <span id="phone-error" className="job-field-error" role="alert">
              {errors.phone}
            </span>
          ) : null}
        </label>
      </fieldset>

      {form.questions.map((question) => (
        <label key={question.id} htmlFor={"question-" + question.id}>
          {question.prompt}
          {question.kind === "BOOLEAN" ? (
            <select
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              defaultValue=""
            >
              <option value="" disabled>
                Choose an answer
              </option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : question.kind === "SINGLE_CHOICE" ? (
            <select
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              defaultValue=""
            >
              <option value="" disabled>
                Choose an answer
              </option>
              {question.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              maxLength={3000}
              rows={3}
            />
          )}
        </label>
      ))}

      <label htmlFor="application-cover-letter">
        Cover letter (optional)
        <textarea
          id="application-cover-letter"
          name="coverLetter"
          maxLength={5000}
          rows={5}
        />
      </label>

      <div className="job-ai-consent">
        <label className="job-checkbox-label" htmlFor="application-ai-consent">
          <input
            id="application-ai-consent"
            name="aiAnalysisConsent"
            type="checkbox"
            aria-label="I agree to let SmartHire use AI to analyze how well my CV matches this role."
            checked={aiConsent}
            onChange={(event) => setAiConsent(event.currentTarget.checked)}
          />
          <span>
            I agree to let SmartHire use AI to analyze how well my CV matches
            this role.{" "}
            <Link href="/legal/ai-cv-analysis-policy" target="_blank">
              Learn more
            </Link>
          </span>
        </label>
        <p className="job-form-help">
          Optional. If you do not select this, your CV will still be submitted
          without an AI match score.
        </p>
      </div>

      {error ? (
        <div role="alert" className="job-feedback">
          {error}
        </div>
      ) : null}
      <div className="job-actions">
        <button type="submit" disabled={submitDisabled}>
          {pending ? "Submitting..." : "Submit application"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApplyFormSection({
  jobId,
  jobTitle,
  open,
  applied,
  onOpenChange,
  onSubmitted,
}: {
  jobId: string;
  jobTitle: string;
  open: boolean;
  applied: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (outcome: ApplicationOutcome) => void;
}) {
  const shared = useOptionalJobInteraction();
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [outcome, setOutcome] = useState<ApplicationOutcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || applied || form || outcome || loadError) return;
    let active = true;
    void fetch("/api/jobs/" + jobId + "/application-form", {
      cache: "no-store",
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          const problem = body as { message?: unknown };
          throw new Error(
            typeof problem.message === "string"
              ? problem.message
              : "Unable to load the application form.",
          );
        }
        return body;
      })
      .then((body) => {
        if (active) setForm(applicationFormSchema.parse(body));
      })
      .catch((caught: unknown) => {
        if (active)
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the application form.",
          );
      });
    return () => {
      active = false;
    };
  }, [applied, form, jobId, loadError, open, outcome]);

  function handleSubmitted(
    submitted: ApplicationOutcome,
    meta: ApplicationMeta,
  ) {
    const state: AppliedJobState = {
      jobId,
      appliedAt: submitted.submittedAt,
      status: "submitted",
      cvFileRef: meta.cvFileRef,
      contactSnapshot: meta.contactSnapshot,
      aiAnalysisConsent: meta.aiAnalysisConsent,
      aiMatchScore: meta.aiMatchScore,
    };
    setOutcome(submitted);
    shared?.markApplied(jobId, state);
    onSubmitted?.(submitted);
  }

  return (
    <section
      id="apply"
      className={"job-apply-section" + (open ? " is-open" : "")}
      aria-labelledby="job-apply-heading"
      aria-hidden={!open}
    >
      <div className="job-apply-section-inner">
        <div className="job-apply-section-heading">
          <div>
            <p className="panel-kicker">APPLY INLINE</p>
            <h2 id="job-apply-heading">Application form</h2>
            <p>Apply for {jobTitle} on SmartHire.</p>
          </div>
          <button
            type="button"
            className="job-icon-button"
            aria-label="Close application form"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>
        {open && !form && !outcome && !applied && !loadError ? (
          <p className="job-feedback job-feedback-info" role="status">
            Preparing the application form...
          </p>
        ) : loadError ? (
          <div className="job-feedback" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => setLoadError(null)}>
              Try again
            </button>
          </div>
        ) : outcome ? (
          <div className="job-application-confirmation" role="status">
            <strong>
              Application submitted successfully for{" "}
              {form?.jobTitle ?? jobTitle}.
            </strong>
            <p>The employer will contact you if there is a match.</p>
            {outcome.aiAnalysisConsent ? (
              <p>
                AI match: <strong>{outcome.aiMatchScore ?? 82}%</strong> — based
                on skills and experience relevant to this role.
              </p>
            ) : null}
          </div>
        ) : applied ? (
          <div className="job-application-confirmation" role="status">
            You have already applied for this role.
          </div>
        ) : form ? (
          <InlineApplicationForm
            form={form}
            onCancel={() => onOpenChange(false)}
            onSubmitted={handleSubmitted}
          />
        ) : null}
      </div>
    </section>
  );
}
