import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/management/job-post-management-service.ts",
  "utf8",
);
const repository = readFileSync(
  "src/backend/repositories/jobs/prisma-job-post-management-repository.ts",
  "utf8",
);

describe("job post management hardening", () => {
  it("uses scoped grants, optimistic versions, and excludes reporter identity", () => {
    expect(service).toContain("jobPostManagementScope[command.command]");
    expect(service).toContain("STALE_CONFLICT");
    expect(repository).toContain("reporterUserId: _reporterUserId");
    expect(repository).not.toContain(
      "reports: reports.map((report) => ({ reporterUserId",
    );
  });
});
