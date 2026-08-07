"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import type {
  ApplicationForm,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";
import { applicationOutcomeSchema } from "@/shared/contracts/jobs/actions";
import { useOptionalJobInteraction } from "./job-interaction-provider";

export function JobApplicationForm({
  form,
  onCancel,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onSubmitted: (outcome: ApplicationOutcome) => void;
}) {
  const workspaceCsrfProof = useCsrfProof();
  const [pending, setPending] = useState(false);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const answers = form.questions.map((question) => ({
      questionId: question.id,
      value:
        question.kind === "BOOLEAN"
          ? data.get(`question-${question.id}`) === "true"
          : String(data.get(`question-${question.id}`) ?? ""),
    }));
    try {
      key.current ??=
        globalThis.crypto?.randomUUID?.() ??
        `application-${new Date().getTime()}-key`;
      const response = await mutateWithCurrentCsrf(
        `/api/jobs/${form.jobId}/applications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key.current,
          },
          body: JSON.stringify({
            cvId: selectedCvId,
            answers,
            coverLetter: String(data.get("coverLetter") ?? "") || null,
            consentVersion: form.consentVersion,
            consentAccepted: data.get("consentAccepted") === "on",
          }),
        },
        form.csrfToken || workspaceCsrfProof,
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = body as { message?: unknown };
        setError(
          typeof problem.message === "string"
            ? problem.message
            : "Application could not be submitted.",
        );
        return;
      }
      const outcome = applicationOutcomeSchema.parse(body);
      setMessage(outcome.message);
      onSubmitted(outcome);
    } catch {
      setError("Application could not be submitted. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="job-form-grid"
      aria-label={`Apply for ${form.jobTitle}`}
      onSubmit={submit}
      onChange={() => {
        // An idempotency key is bound to one exact submission. If the
        // candidate edits the form after a failed attempt, the next payload
        // must receive a fresh key instead of being rejected as a rebound.
        key.current = null;
        setError(null);
      }}
    >
      {!form.profileReady ? (
        <div role="alert">
          Complete these profile fields first:{" "}
          {form.missingProfileFields.join(", ")}.
        </div>
      ) : null}
      <label>
        Select CV
        <select
          name="cvId"
          required
          disabled={pending || !form.profileReady || form.cvs.length === 0}
          aria-describedby={
            form.cvs.length === 0 ? "application-cv-requirement" : undefined
          }
          value={selectedCvId}
          onChange={(event) => setSelectedCvId(event.currentTarget.value)}
        >
          <option value="" disabled>
            Choose a confirmed CV
          </option>
          {form.cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.displayName} · {cv.fileName}
            </option>
          ))}
        </select>
      </label>
      {form.cvs.length === 0 ? (
        <div id="application-cv-requirement" role="alert">
          No retained application CV is available. CV Import can update your
          profile, but its temporary source file cannot be attached to a job
          application.
        </div>
      ) : null}
      {form.questions.map((question) => (
        <label key={question.id}>
          {question.prompt}
          {question.kind === "BOOLEAN" ? (
            <select
              name={`question-${question.id}`}
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
              name={`question-${question.id}`}
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
              name={`question-${question.id}`}
              required={question.required}
              maxLength={3000}
              rows={3}
            />
          )}
        </label>
      ))}
      <label>
        Cover letter (optional)
        <textarea name="coverLetter" maxLength={5000} rows={5} />
      </label>
      <label>
        <input name="consentAccepted" type="checkbox" required /> I consent to
        SmartHire sharing this application with the hiring company.
      </label>
      {error ? (
        <div role="alert" className="job-feedback">
          {error}
        </div>
      ) : null}
      {message ? (
        <div role="status" className="job-feedback">
          {message}
        </div>
      ) : null}
      <div className="job-actions">
        <button
          type="submit"
          disabled={
            pending ||
            !form.profileReady ||
            form.cvs.length === 0 ||
            !selectedCvId
          }
        >
          {pending ? "Submitting…" : "Submit application"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function JobApplicationAction({
  jobId,
  jobSlug,
  initialApplied = false,
  onActivate,
}: {
  jobId: string;
  jobSlug?: string;
  initialApplied?: boolean;
  onActivate?: () => void;
}) {
  const shared = useOptionalJobInteraction();
  const applied = initialApplied || Boolean(shared?.records[jobId]?.applied);
  if (applied) {
    return (
      <span role="status" className="job-applied-state">
        ✓ Applied
      </span>
    );
  }
  return (
    <Link
      className="sh-button job-card-apply-button"
      href={"/jobs/" + (jobSlug ?? jobId) + "?apply=true"}
      aria-label="Apply now"
      onClick={onActivate}
    >
      Apply now
    </Link>
  );
}
