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
  }>();
  const dataProvider = useDataProvider<AdminDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState("");
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
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
