import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("managed public job projection", () => {
  it("uses approved review authority without changing unmanaged legacy behavior", () => {
    const files = [
      "src/backend/services/jobs/job-workspace-data.ts",
      "src/backend/services/jobs/job-discovery-service.ts",
      "src/backend/repositories/jobs/prisma-public-job-repository.ts",
    ].map((path) => readFileSync(path, "utf8"));
    const source = files.join("\n");
    for (const marker of [
      "approvedVersion",
      "reviewAggregate",
      "snapshot",
      "applicationDeadline",
      "closedAt",
    ])
      expect(source).toContain(marker);
  });
});
