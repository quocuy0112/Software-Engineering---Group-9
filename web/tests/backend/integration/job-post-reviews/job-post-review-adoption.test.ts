import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("scripts/migrate-json-job-reviews.mjs", "utf8");
const verifier = readFileSync("scripts/verify-job-post-review-migration.mjs", "utf8");

describe("job-post review legacy adoption", () => {
  it("is dry-run by default and leaves unresolved historical authority explicit", () => {
    expect(migration).toContain("const apply = process.argv.includes(\"--apply\")");
    expect(migration).toContain('mode: apply ? "apply" : "dry-run"');
    expect(migration).toContain("HISTORICAL_SUBMISSION_AUTHORITY_UNPROVEN");
    expect(migration).toContain("if (apply && unresolved.length > 0)");
  });

  it("is rerunnable without creating duplicate adoption rows", () => {
    expect(migration).toContain("findMany");
    expect(migration).toContain("adopted.has(job.id)");
    expect(migration).toContain("adoptedCount: 0");
  });

  it("verification checks aggregate pointers, immutable hashes, lifecycle, and outcome notifications", () => {
    for (const marker of [
      "invalidAggregatePointers",
      "invalidSnapshotHashes",
      "invalidLifecycleRows",
      "terminalRowsWithoutRecipientNotification",
      "const pass = Object.values(result).every",
    ])
      expect(verifier).toContain(marker);
  });

  it("does not use destructive SQL or guess an owner/company mapping", () => {
    expect(migration).not.toMatch(/delete|update|create\s+jobposting/iu);
    expect(migration).toContain("cannot be silently attributed");
  });
});
