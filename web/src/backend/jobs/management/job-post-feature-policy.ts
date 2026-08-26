import type { JobManagementCommand } from "@/shared/contracts/admin/job-post-management";

export const FEATURED_PLACEMENT_CAPACITY = 6;

/** Feature windows are valid only when the finish is strictly after the start. */
export function assertFeatureWindow(
  command: Extract<
    JobManagementCommand,
    { command: "FEATURE" | "AMEND_FEATURE" }
  >,
) {
  if (command.endsAt <= command.startsAt) throw new Error("VALIDATION_FAILED");
}
