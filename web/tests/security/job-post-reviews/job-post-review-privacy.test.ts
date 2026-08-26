import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("job-post decision privacy", () => {
  it("keeps contacts, evidence, applications and private notes outside public outcomes and logs", () => {
    const operations = readFileSync(
      "src/backend/jobs/review/job-post-review-operations.ts",
      "utf8",
    );
    expect(operations).not.toMatch(
      /snapshot|publicExplanation|privateNote|email|phone|evidence|application/iu,
    );
    const notificationPolicy = readFileSync(
      "src/backend/notifications/event-policy.ts",
      "utf8",
    );
    expect(notificationPolicy).toContain("JOB_POST_APPROVED");
    expect(notificationPolicy).toContain("JOB_POST_REJECTED");
  });
});
