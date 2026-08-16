import type { PlatformAdministratorScope } from "@/backend/generated/prisma/client";
import type { JobManagementCommand } from "@/shared/contracts/admin/job-post-management";

export const jobPostManagementScope: Record<
  JobManagementCommand["command"],
  PlatformAdministratorScope
> = {
  HIDE: "JOB_POST_MODERATE",
  RESTORE: "JOB_POST_MODERATE",
  CLOSE_APPLICATIONS: "JOB_POST_MODERATE",
  REOPEN_APPLICATIONS: "JOB_POST_MODERATE",
  ARCHIVE: "JOB_POST_MODERATE",
  REQUEST_CHANGES: "JOB_POST_MODERATE",
  FEATURE: "JOB_POST_FEATURE",
  AMEND_FEATURE: "JOB_POST_FEATURE",
  UNFEATURE: "JOB_POST_FEATURE",
  SOFT_DELETE: "JOB_POST_ENFORCE",
  ENFORCE: "JOB_POST_ENFORCE",
};

export const FEATURED_PLACEMENT_CAPACITY = 6;

type OperationalState = {
  visibility: "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  applicationState: "OPEN" | "CLOSED";
  softDeleted: boolean;
  applicationDeadline: Date | null;
};

/** Reject invalid lifecycle changes before any durable update is attempted. */
export function assertJobPostManagementTransition(
  command: JobManagementCommand,
  state: OperationalState,
  now: Date,
) {
  if (state.softDeleted && command.command !== "SOFT_DELETE") {
    throw new Error("INVALID_STATE");
  }

  switch (command.command) {
    case "HIDE":
      if (state.visibility !== "PUBLISHED") throw new Error("INVALID_STATE");
      break;
    case "RESTORE":
      if (state.visibility === "PUBLISHED") throw new Error("INVALID_STATE");
      break;
    case "CLOSE_APPLICATIONS":
      if (state.applicationState !== "OPEN") throw new Error("INVALID_STATE");
      break;
    case "REOPEN_APPLICATIONS":
      if (
        state.applicationState !== "CLOSED" ||
        state.visibility === "ARCHIVED" ||
        (state.applicationDeadline && state.applicationDeadline <= now)
      ) {
        throw new Error("INVALID_STATE");
      }
      break;
    case "ARCHIVE":
      if (state.visibility === "ARCHIVED") throw new Error("INVALID_STATE");
      break;
    case "REQUEST_CHANGES":
      if (state.visibility === "ARCHIVED") throw new Error("INVALID_STATE");
      break;
    case "FEATURE":
    case "AMEND_FEATURE":
      if (
        state.visibility !== "PUBLISHED" ||
        state.applicationState !== "OPEN" ||
        (state.applicationDeadline && state.applicationDeadline <= now) ||
        command.endsAt <= command.startsAt
      ) {
        throw new Error("VALIDATION_FAILED");
      }
      break;
    default:
      break;
  }
}
