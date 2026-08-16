import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  "src/backend/admin/workers/job-post-lifecycle-loop.ts",
  "utf8",
);

describe("managed job deadline worker", () => {
  it("processes bounded, versioned archive work with audit history", () => {
    expect(worker).toContain("take: 100");
    expect(worker).toContain("version: row.version");
    expect(worker).toContain('visibilityState: "ARCHIVED"');
    expect(worker).toContain("PrismaAuditRepository");
  });
});
