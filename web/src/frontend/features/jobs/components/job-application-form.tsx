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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { jobApplicationCopy } from "./job-application-copy";
import { useOptionalJobInteraction } from "./job-interaction-provider";
import { jobCopy } from "./job-copy";

export function JobApplicationForm({
  form,
  onCancel,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onSubmitted: (outcome: ApplicationOutcome) => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = jobApplicationCopy(locale);
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
          typeof problem.message === "string" && locale === "en"
            ? problem.message
            : copy.errors.submit,
        );
        return;
      }
      const outcome = applicationOutcomeSchema.parse(body);
      setMessage(copy.submitted);
      onSubmitted(outcome);
    } catch {
      setError(copy.errors.submitTryAgain);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="job-form-grid"
      aria-label={copy.applyFor(form.jobTitle)}
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
          {copy.profileIncomplete(
            form.missingProfileFields
              .map((field) => copy.profileFields[field] ?? field)
              .join(", "),
          )}
        </div>
      ) : null}
      <label>
        {copy.selectCv}
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
            {copy.savedCvPlaceholder}
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
          {locale === "vi"
            ? "Không có CV ứng tuyển đã lưu. Bạn có thể cập nhật Hồ sơ bằng tính năng Nhập CV, nhưng không thể đính kèm tệp tạm thời đó vào đơn ứng tuyển."
            : "No retained application CV is available. CV Import can update your profile, but its temporary source file cannot be attached to a job application."}
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
                {copy.chooseAnswer}
              </option>
              <option value="true">{copy.yes}</option>
              <option value="false">{copy.no}</option>
            </select>
          ) : question.kind === "SINGLE_CHOICE" ? (
            <select
              name={`question-${question.id}`}
              required={question.required}
              defaultValue=""
            >
              <option value="" disabled>
                {copy.chooseAnswer}
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
        {copy.coverLetterOptional}
        <textarea name="coverLetter" maxLength={5000} rows={5} />
      </label>
      <label>
        <input
          name="consentAccepted"
          type="checkbox"
          required
          aria-label={copy.consentAria}
        /> {copy.consentText}
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
          {pending ? copy.submitting : copy.submitApplication}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          {locale === "vi" ? "Hủy" : "Cancel"}
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
  const copy = jobCopy(useWorkspaceLocale());
  const shared = useOptionalJobInteraction();
  const applied = initialApplied || Boolean(shared?.records[jobId]?.applied);
  if (applied) {
    return (
      <span role="status" className="job-applied-state">
        ✓ {copy.applied}
      </span>
    );
  }
  return (
    <Link
      className="sh-button job-card-apply-button"
      href={"/jobs/" + (jobSlug ?? jobId) + "/apply"}
      aria-label={copy.applyNow}
      onClick={onActivate}
    >
      {copy.applyNow}
    </Link>
  );
}
