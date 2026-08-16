import { describe, expect, it } from "vitest";
import { jobManagementCommandSchema } from "@/shared/contracts/admin/job-post-management";

describe("job post lifecycle contract", () => {
  it("requires confirmed, reasoned lifecycle commands", () => {
    for (const command of [
      "HIDE",
      "RESTORE",
      "CLOSE_APPLICATIONS",
      "REOPEN_APPLICATIONS",
      "ARCHIVE",
      "SOFT_DELETE",
    ] as const) {
      expect(
        jobManagementCommandSchema.safeParse({
          command,
          confirmation: true,
          reason: "A documented operational reason.",
        }).success,
      ).toBe(true);
      expect(
        jobManagementCommandSchema.safeParse({ command, confirmation: true })
          .success,
      ).toBe(false);
    }
  });
});
