import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Recruiter submission failure boundaries", () => {
  it("keeps database effects transactional and catalogue replacement fenced", () => {
    const submission = readFileSync(
      "src/backend/jobs/review/job-post-submission-service.ts",
      "utf8",
    );
    const catalogue = readFileSync(
      "src/backend/repositories/jobs/json-job-catalogue-repository.ts",
      "utf8",
    );
    expect(submission).toContain("prisma.$transaction");
    expect(catalogue).toContain("JOB_CATALOGUE_CHECKSUM_CONFLICT");
    expect(catalogue).toContain("assertOwned");
    expect(catalogue).toContain("handle.sync()");
    expect(catalogue).toContain("rename(temporaryPath, this.filePath)");
  });
});
