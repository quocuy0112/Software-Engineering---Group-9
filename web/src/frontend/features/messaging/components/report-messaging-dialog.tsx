"use client";

import { useRef, useState } from "react";
import type { MessagingMessage } from "@/shared/contracts/messaging/messages";
import { messagingReportInputSchema } from "@/shared/contracts/messaging/safety";
import { submitMessagingReport } from "../client/messaging-api";

const categories = [
  ["FRAUD_OR_IMPERSONATION", "Fraud or impersonation"],
  ["MISLEADING_CONTENT", "Misleading content"],
  ["DISCRIMINATION_OR_HARASSMENT", "Discrimination or harassment"],
  ["ABUSE_OR_THREATS", "Abuse or threats"],
  ["SPAM_OR_DUPLICATE", "Spam"],
  ["PRIVACY_OR_DATA_MISUSE", "Privacy or data misuse"],
  ["OTHER", "Other"],
] as const;

export function ReportMessagingDialog({
  csrfProof,
  conversationId,
  targetUserId,
  messages,
}: {
  csrfProof: string;
  conversationId: string;
  targetUserId: string;
  messages: MessagingMessage[];
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof categories)[number][0]>(
    "SPAM_OR_DUPLICATE",
  );
  const [detail, setDetail] = useState("");
  const [evidenceMessageId, setEvidenceMessageId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    queueMicrotask(() => trigger.current?.focus());
  }

  async function submit() {
    const parsed = messagingReportInputSchema.safeParse({
      conversationId,
      targetUserId,
      targetType: "CONVERSATION",
      evidenceMessageId: evidenceMessageId || null,
      category,
      detail,
    });
    if (!parsed.success) {
      setStatus("Provide at least 10 characters when selecting Other.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await submitMessagingReport(parsed.data, csrfProof);
      setStatus("Report received and queued for protected review.");
    } catch {
      setStatus("The report could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="messaging-safety-control">
      <button
        ref={trigger}
        className="messaging-icon-button"
        type="button"
        aria-label="Report"
        title="Report conversation"
        onClick={() => setOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 21V4m0 1h12l-2 4 2 4H5" />
        </svg>
        <span className="sr-only">Report</span>
      </button>
      {open ? (
        <div className="messaging-modal-layer">
          <section className="messaging-modal messaging-report-modal" role="dialog" aria-modal="true" aria-label="Report conversation">
            <div className="messaging-modal-heading">
              <div className="messaging-modal-icon" data-tone="warning" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 21V4m0 1h12l-2 4 2 4H5" />
                </svg>
              </div>
              <div>
                <h3>Report harmful communication</h3>
                <p>Your report is private and reviewed through protected moderation channels.</p>
              </div>
            </div>
            <div className="messaging-report-fields">
              <label>
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Evidence message (optional)</span>
                <select value={evidenceMessageId} onChange={(event) => setEvidenceMessageId(event.target.value)}>
                  <option value="">No specific message</option>
                  {messages.map((message) => (
                    <option key={message.id} value={message.id}>
                      {message.content.slice(0, 80)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Details (optional)</span>
                <textarea
                  aria-label="Details (optional)"
                  maxLength={500}
                  placeholder="Add context that can help the review..."
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                />
                <small>{detail.length}/500</small>
              </label>
            </div>
            {status ? <p className="messaging-report-status" role="status">{status}</p> : null}
            <div className="messaging-modal-actions messaging-modal-actions-inline">
              <button className="messaging-danger-button" type="button" disabled={busy} onClick={() => void submit()}>
                {busy ? "Submitting..." : "Submit report"}
              </button>
              <button className="messaging-secondary-button" type="button" disabled={busy} onClick={close}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
