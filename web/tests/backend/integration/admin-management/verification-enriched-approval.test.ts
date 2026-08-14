import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Feature 006 approval gates remain authoritative", () => {
  const source = readFileSync(
    "src/backend/admin/verification/verification-approval-transaction.ts",
    "utf8",
  );

  it("requires review state, safe evidence, active applicant, and enriched facts", () => {
    for (const gate of [
      'row.state !== "PENDING_REVIEW"',
      'row.applicant.state !== "ACTIVE"',
      'row.evidence.malwareStatus !== "PASS"',
      'row.evidence.typeStatus !== "PASS"',
      'row.evidence.structureStatus !== "PASS"',
      'row.evidence.previewStatus !== "PASS"',
      "row.submissionIdempotencyKey && !row.businessFacts",
    ]) {
      expect(source).toContain(gate);
    }
    expect(source).not.toMatch(/registry.*outcome.*APPROVED/iu);
  });
});
