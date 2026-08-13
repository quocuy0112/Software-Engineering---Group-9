"use client";

import { useRecruiterHeaderNavigation } from "../client/use-recruiter-header-navigation";
import { useRecruiterHeaderStatus } from "../client/use-recruiter-header-status";
import type { RecruiterHeaderStatus } from "@/shared/contracts/recruiter-header-status";

export function RecruiterHeaderAction({
  initialStatus,
  onOpenWorkspace,
}: {
  initialStatus?: RecruiterHeaderStatus | null;
  onOpenWorkspace?: () => void;
}) {
  const { status, checking, unavailable } =
    useRecruiterHeaderStatus(initialStatus);
  const navigation = useRecruiterHeaderNavigation();

  if (!status) {
    return (
      <span
        className="recruiter-header-action recruiter-header-action--placeholder"
        role="status"
        aria-live="polite"
        aria-label="Checking status"
        data-recruiter-state="placeholder"
      >
        <span className="recruiter-header-action__icon" aria-hidden="true" />
        <span className="recruiter-header-action__label">Checking status</span>
      </span>
    );
  }

  const pending = status.state === "PENDING_REVIEW";
  const approved = status.state === "APPROVED";
  const label = pending
    ? "Application Under Review"
    : status.state === "REJECTED"
      ? "Reapply as Recruiter"
      : approved
        ? onOpenWorkspace
          ? "Post a Job"
          : "Recruiter Workspace"
        : "Apply as Recruiter";
  const busy = checking || navigation.busy;
  const state = unavailable
    ? "unavailable"
    : busy
      ? "revalidating"
      : status.state.toLowerCase();

  return (
    <button
      type="button"
      className={[
        "recruiter-header-action",
        approved || status.state === "NEVER_APPLIED"
          ? "recruiter-header-action--primary"
          : "recruiter-header-action--secondary",
      ].join(" ")}
      aria-disabled={pending || busy ? true : undefined}
      aria-busy={busy || undefined}
      data-recruiter-state={state}
      tabIndex={pending ? 0 : undefined}
      onClick={() => {
        if (pending || busy) return;
        if (approved && onOpenWorkspace) {
          onOpenWorkspace();
          return;
        }
        navigation.open(status.href);
      }}
      onKeyDown={(event) => {
        if (pending || busy) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
          }
        }
      }}
    >
      <span className="recruiter-header-action__icon" aria-hidden="true">
        {pending ? "…" : approved ? "↗" : "＋"}
      </span>
      <span className="recruiter-header-action__label">{label}</span>
    </button>
  );
}
