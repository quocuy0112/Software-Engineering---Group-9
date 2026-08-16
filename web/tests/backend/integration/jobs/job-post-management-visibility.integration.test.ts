import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  "src/backend/repositories/jobs/prisma-public-job-repository.ts",
  "utf8",
);

describe("candidate visibility for managed jobs", () => {
  it("keeps a closed post readable while discovery remains active-only", () => {
    expect(repository).toContain('status: { in: ["ACTIVE", "CLOSED"] }');
    expect(repository).toContain("Prisma.sql`j.\"status\" = 'ACTIVE'");
    expect(repository).toContain('visibilityState: "PUBLISHED"');
    expect(repository).toContain('verificationState: "ACTIVE"');
  });
});
