"use client";
import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
} from "react-admin";
import type { AdminDataProvider } from "../app/data-provider";

export function JobPostReviewActionPanel() {
  const record = useRecordContext<{
    id: string;
    state: string;
    assignment: string | null;
    version: number;
    integrityState: "VALID" | "BLOCKED";
    company?: { active?: boolean };
    submitter?: { currentlyEligible?: boolean };
  }>();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState("");
  const [reasonCode, setReasonCode] = useState("INCOMPLETE_OR_UNCLEAR");
  const [publicExplanation, setPublicExplanation] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  if (!record || record.state !== "PENDING_REVIEW") return null;

  const execute = async (action: "claim" | "reassign") => {
    try {
      await dataProvider.command(
        `/api/admin/job-post-reviews/${encodeURIComponent(record.id)}/${action}`,
        action === "claim"
          ? { command: "CLAIM" }
          : { command: "REASSIGN", targetAdminUserId: target },
        record.version,
        crypto.randomUUID(),
      );
      setStatus(action === "claim" ? "Claimed" : "Reassigned");
      refresh();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "ACTION_FAILED";
      setStatus(
        code === "STALE_CONFLICT" ? "STALE_CONFLICT — reload required" : code,
      );
      notify(code, { type: "warning" });
    }
  };

  const decide = async (action: "approve" | "reject") => {
    const label = action === "approve" ? "approve" : "reject";
    if (!window.confirm(`Confirm ${label} of this exact submitted version?`))
      return;
    try {
      const result = (await dataProvider.command(
        `/api/admin/job-post-reviews/${encodeURIComponent(record.id)}/${action}`,
        action === "approve"
          ? { command: "APPROVE" }
          : {
              command: "REJECT",
              reasonCode,
              publicExplanation,
              ...(privateNote.trim() ? { privateNote } : {}),
            },
        record.version,
        crypto.randomUUID(),
      )) as { status?: string; code?: string };
      if (result.status === "ACTION_BLOCKED") {
        setStatus(`Decision result: ${result.code ?? "ACTION_BLOCKED"}`);
        notify(result.code ?? "ACTION_BLOCKED", { type: "warning" });
      } else {
        setStatus(
          `Decision result: ${action === "approve" ? "Approved" : "Rejected"}`,
        );
        notify(action === "approve" ? "Approved" : "Rejected", {
          type: "success",
        });
      }
      refresh();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "ACTION_FAILED";
      setStatus(
        `Decision result: ${
          code === "STALE_CONFLICT" ? "STALE_CONFLICT - reload required" : code
        }`,
      );
      notify(code, { type: "warning" });
    }
  };

  const approvalBlocked =
    record.integrityState !== "VALID" ||
    !record.assignment ||
    !record.company?.active ||
    !record.submitter?.currentlyEligible;
  const rejectionBlocked =
    record.integrityState !== "VALID" || !record.assignment;

  return (
    <section aria-label="Review assignment actions">
      <h3>Assignment</h3>
      <button type="button" onClick={() => void execute("claim")}>
        Claim
      </button>
      <label>
        Reassign to Administrator user id
        <input
          aria-label="Target Administrator user id"
          value={target}
          onFocus={() => setStatus("Enter an active Administrator user id")}
          onChange={(event) => setTarget(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        disabled={!target.trim()}
        onClick={() => void execute("reassign")}
      >
        Reassign
      </button>
      <h3>Decision</h3>
      <button
        type="button"
        aria-label="Approve exact version"
        disabled={approvalBlocked}
        onClick={() => void decide("approve")}
      >
        Approve exact version
      </button>
      {approvalBlocked ? (
        <p>Approval is blocked until assignment and eligibility are valid.</p>
      ) : null}
      <label>
        Rejection reason
        <select
          aria-label="Rejection reason"
          value={reasonCode}
          onChange={(event) => setReasonCode(event.currentTarget.value)}
        >
          <option value="INCOMPLETE_OR_UNCLEAR">Incomplete or unclear</option>
          <option value="MISLEADING_CONTENT">Misleading content</option>
          <option value="COMPENSATION_OR_LOCATION_UNCLEAR">
            Compensation or location unclear
          </option>
          <option value="DISCRIMINATORY_OR_PROHIBITED">
            Discriminatory or prohibited
          </option>
          <option value="COMPANY_OR_ROLE_MISMATCH">
            Company or role mismatch
          </option>
          <option value="DUPLICATE_OR_SPAM">Duplicate or spam</option>
          <option value="EXPIRED_OR_INVALID_DEADLINE">
            Expired or invalid deadline
          </option>
          <option value="POLICY_OR_LEGAL_RISK">Policy or legal risk</option>
          <option value="OTHER_ACTION_REQUIRED">Other action required</option>
        </select>
      </label>
      <label>
        Public explanation
        <textarea
          aria-label="Public explanation"
          minLength={20}
          maxLength={1000}
          value={publicExplanation}
          onChange={(event) => setPublicExplanation(event.currentTarget.value)}
        />
      </label>
      <label>
        Administrator private note
        <textarea
          aria-label="Administrator private note"
          maxLength={2000}
          value={privateNote}
          onChange={(event) => setPrivateNote(event.currentTarget.value)}
        />
      </label>
      <button
        type="button"
        aria-label="Reject exact version"
        disabled={rejectionBlocked || publicExplanation.trim().length < 20}
        onClick={() => void decide("reject")}
      >
        Reject exact version
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
