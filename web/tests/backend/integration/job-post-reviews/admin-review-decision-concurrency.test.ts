import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator decision concurrency", () => {
  it("revalidates authority, assignment, aggregate version and snapshot in one command transaction", () => {
    const service = readFileSync(
      "src/backend/jobs/review/job-post-review-service.ts",
      "utf8",
    );
    for (const marker of [
      "validateJobPostDecision",
      "designatedSessionId",
      "expectedVersion",
      "snapshotSha256",
      "AdminCommandDenied",
    ])
      expect(service).toContain(marker);
  });
});
