"use client";

import { useRef, useState, type FormEvent } from "react";
import type {
  ApplicationForm,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";

export function JobApplicationForm({
  form,
  onCancel,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onSubmitted: (outcome: ApplicationOutcome) => void;
}) {
  const [pending, setPending] = useState(false);
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
      const response = await fetch(`/api/jobs/${form.jobId}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": form.csrfToken,
          "Idempotency-Key": key.current,
        },
        body: JSON.stringify({
          cvId: data.get("cvId"),
          answers,
          coverLetter: String(data.get("coverLetter") ?? "") || null,
          consentVersion: form.consentVersion,
          consentAccepted: data.get("consentAccepted") === "on",
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : "Application could not be submitted.",
        );
        return;
      }
      const outcome = body as ApplicationOutcome;
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
          disabled={pending || !form.profileReady}
          defaultValue=""
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
        <div role="alert">A confirmed PDF or DOCX CV is required.</div>
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
          disabled={pending || !form.profileReady || form.cvs.length === 0}
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

export function JobApplicationAction({ jobId }: { jobId: string }) {
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<ApplicationOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/application-form`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "Application form could not be loaded.");
        return;
      }
      setForm(body);
      setOpen(true);
    } catch {
      setError("Application form could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      {outcome ? (
        <span role="status" className="job-feedback">
          {outcome.message}
        </span>
      ) : (
        <button type="button" onClick={() => void start()} disabled={loading}>
          {loading ? "Loading…" : "Apply now"}
        </button>
      )}
      {error ? <span role="alert">{error}</span> : null}
      {open && form ? (
        <div className="job-dialog-backdrop">
          <div
            className="job-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-dialog-title"
          >
            <h2 id="application-dialog-title">Apply for {form.jobTitle}</h2>
            <JobApplicationForm
              form={form}
              onCancel={() => setOpen(false)}
              onSubmitted={(submitted) => {
                setOutcome(submitted);
                setOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
