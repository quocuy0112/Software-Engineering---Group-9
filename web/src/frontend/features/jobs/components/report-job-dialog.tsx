"use client";

import { useRef, useState } from "react";
import { currentCsrfProof } from "@/frontend/features/authentication/client/current-csrf-proof";
import { Modal } from "@/frontend/components/ui/modal";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  jobReportInputSchema,
  jobReportOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import { jobCopy } from "./job-copy";

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
  const copy = jobCopy(useWorkspaceLocale());
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
      setError(copy.reviewReportFields);
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
        throw new Error("JOB_REPORT_REQUEST_FAILED");
      }
      jobReportOutcomeSchema.parse(body);
      setMessage(copy.reportSubmitted);
      setReason("");
      setDetails("");
      close();
    } catch {
      setError(copy.reportFailed);
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
        {copy.reportJob}
      </button>
      {message ? <span role="status">{message}</span> : null}
      <Modal
        open={open}
        title={copy.reportJob}
        description={copy.reportDescription}
        busy={pending}
        onClose={close}
      >
        <form
          className="job-form-grid"
          aria-label={copy.reportJob}
          onSubmit={submit}
        >
          <label>
            {copy.reason}
            <select
              data-autofocus
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="" disabled>
                {copy.selectReason}
              </option>
              {reasons.map(([value]) => (
                <option key={value} value={value}>
                  {copy.reportReasons[value]}
                </option>
              ))}
            </select>
          </label>
          {reason ? (
            <label>
              {copy.details}{" "}
              {detailsRequired.has(reason) ? copy.required : copy.optional}
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
                {copy.reportPrivacyHint}
              </span>
            </label>
          ) : null}
          {error ? <div role="alert">{error}</div> : null}
          <div className="job-actions">
            <button type="submit" disabled={pending}>
              {pending ? copy.submittingReport : copy.submitReport}
            </button>
            <button type="button" disabled={pending} onClick={close}>
              {copy.cancel}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
