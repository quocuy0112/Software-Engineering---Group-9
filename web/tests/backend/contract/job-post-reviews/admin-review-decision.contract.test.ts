import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator decision contract", () => {
  it("dispatches strict approve/reject commands with replay and stale protection", () => {
    const route = readFileSync(
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
      "utf8",
    );
    const service = readFileSync(
      "src/backend/jobs/review/job-post-review-service.ts",
      "utf8",
    );
    const commandRepository = readFileSync(
      "src/backend/repositories/admin/prisma-admin-command-repository.ts",
      "utf8",
    );
    for (const marker of ["approve", "reject", "APPROVE", "REJECT"])
      expect(route).toContain(marker);
    for (const marker of [
      "PrismaAdminCommandRepository",
      "expectedVersion",
      "IDEMPOTENCY_CONFLICT",
      "STALE_CONFLICT",
    ])
      expect(`${route}\n${service}\n${commandRepository}`).toContain(marker);
  });
});
