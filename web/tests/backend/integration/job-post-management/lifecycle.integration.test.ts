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

describe("managed job lifecycle transaction", () => {
  it("uses versioned receipts and synchronizes the public projection", () => {
    expect(service).toContain("new PrismaAdminCommandRepository().execute");
    expect(service).toContain('new AdminCommandConflict("STALE_CONFLICT"');
    expect(service).toContain("jobPostOperationalHistory.create");
    expect(repository).toContain("syncManagedJobPublicProjection");
    expect(repository).toContain(': "REMOVED"');
  });
});
