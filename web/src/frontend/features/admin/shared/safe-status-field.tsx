"use client";
import { Chip } from "@mui/material";

const labels: Record<string, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REMOVED: "Removed",
  PENDING_REVIEW: "Pending review",
  PENDING_CHECKS: "Safety checks pending",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export function SafeStatusField({ value }: { value: string }) {
  return (
    <Chip
      component="span"
      variant="outlined"
      label={labels[value] ?? value.replaceAll("_", " ")}
      aria-label={`Status: ${labels[value] ?? value}`}
    />
  );
}

export function AdminStateMessage({
  state,
  children,
}: {
  state:
    | "loading"
    | "empty"
    | "success"
    | "validation"
    | "conflict"
    | "failure";
  children: React.ReactNode;
}) {
  return (
    <div
      role={state === "failure" || state === "validation" ? "alert" : "status"}
      aria-live="polite"
      data-state={state}
    >
      {children}
    </div>
  );
}
