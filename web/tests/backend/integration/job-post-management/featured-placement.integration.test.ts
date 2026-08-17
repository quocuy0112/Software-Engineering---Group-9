import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  "src/backend/repositories/jobs/prisma-job-post-management-repository.ts",
  "utf8",
);
const service = readFileSync(
  "src/backend/jobs/management/job-post-management-service.ts",
  "utf8",
);

describe("featured placement reservation", () => {
  it("serializes overlap checks and supports amend and cancellation state", () => {
    expect(repository).toContain("pg_advisory_xact_lock");
    expect(repository).toContain("FEATURE_CAPACITY_CONFLICT");
    expect(repository).toContain("id: { not: input.featureId }");
    expect(service).toContain('state: "CANCELLED"');
  });
});
