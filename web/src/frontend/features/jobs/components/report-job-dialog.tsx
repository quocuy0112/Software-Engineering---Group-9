"use client";

import { useRef, useState } from "react";
import { currentCsrfProof } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  jobReportInputSchema,
  jobReportOutcomeSchema,
} from "@/shared/contracts/jobs/actions";

const reasons = [
  ["FRAUD", "Fraud or scam"],
  ["MISLEADING", "Misleading information"],
  ["DUPLICATE", "Duplicate posting"],
  ["DISCRIMINATORY", "Discriminatory content"],
  ["INAPPROPRIATE", "Inappropriate content"],
  ["OTHER", "Other concern"],
] as const;

const detailsRequired = new Set(["OTHER", "MISLEADING", "DISCRIMINATORY"]);

export function ReportJobDialog({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function close() {
    setOpen(false);
    setPending(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = jobReportInputSchema.safeParse({
      reason,
      details: details || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the report fields.");
      return;
    }
    setPending(true);
    try {
      const proof = await currentCsrfProof("");
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": proof,
          },
          body: JSON.stringify(parsed.data),
        },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = body as { message?: unknown };
        throw new Error(
          typeof problem.message === "string"
            ? problem.message
            : "Could not submit this report. Try again.",
        );
      }
      const outcome = jobReportOutcomeSchema.parse(body);
      setMessage(outcome.message);
      setReason("");
      setDetails("");
      close();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit this report. Try again.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <button
        className={className}
        ref={trigger}
        type="button"
        onClick={() => {
          setMessage("");
          setError("");
          setOpen(true);
        }}
      >
        Report job
      </button>
      {message ? <span role="status">{message}</span> : null}
      {open ? (
        <div className="job-dialog-backdrop">
          <div
            className="job-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-job-title"
          >
            <h2 id="report-job-title">Report this job</h2>
            <p>
              Your report is private and will be reviewed by authorized
              moderators. It does not automatically remove the job.
            </p>
            <form
              className="job-form-grid"
              aria-label="Report this job"
              onSubmit={submit}
            >
              <label>
                Reason
                <select
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  <option value="" disabled>
                    Select a reason
                  </option>
                  {reasons.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {reason ? (
                <label>
                  Details{" "}
                  {detailsRequired.has(reason) ? "(required)" : "(optional)"}
                  <textarea
                    aria-describedby="report-detail-help"
                    required={detailsRequired.has(reason)}
                    minLength={detailsRequired.has(reason) ? 20 : undefined}
                    maxLength={2000}
                    rows={5}
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                  />
                  <span id="report-detail-help">
                    Do not include passwords, CV content, or unnecessary
                    personal data.
                  </span>
                </label>
              ) : null}
              {error ? <div role="alert">{error}</div> : null}
              <div className="job-actions">
                <button type="submit" disabled={pending}>
                  {pending ? "Submitting report…" : "Submit report"}
                </button>
                <button type="button" disabled={pending} onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
