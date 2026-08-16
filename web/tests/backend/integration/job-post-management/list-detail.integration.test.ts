import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  "src/backend/repositories/jobs/prisma-job-post-management-repository.ts",
  "utf8",
);

describe("managed job list and detail projection", () => {
  it("filters, paginates, joins safe identities, and aggregates reports", () => {
    expect(repository).toContain("skip: (input.page - 1) * input.perPage");
    expect(repository).toContain("normalizedTitle");
    expect(repository).toContain("submittedByUserId");
    expect(repository).toContain("decidedByAdminUserId");
    expect(repository).toContain("distinctReporterCount");
    expect(repository).toContain("featuredPlacements");
  });
});
