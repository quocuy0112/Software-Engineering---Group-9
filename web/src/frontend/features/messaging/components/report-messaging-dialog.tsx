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
      setStatus("Report received.");
    } catch {
      setStatus("The report could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        Report
      </button>
      {open ? (
        <section role="dialog" aria-modal="true" aria-label="Report conversation">
          <h3>Report harmful communication</h3>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence message (optional)
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
            Details (optional)
            <textarea maxLength={500} value={detail} onChange={(event) => setDetail(event.target.value)} />
          </label>
          {status ? <p role="status">{status}</p> : null}
          <button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Submitting..." : "Submit report"}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Close
          </button>
        </section>
      ) : null}
    </div>
  );
}
