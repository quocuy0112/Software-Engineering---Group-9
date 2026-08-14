import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Feature 006 approval gates remain authoritative", () => {
  const source = readFileSync(
    "src/backend/admin/verification/verification-decision-eligibility.ts",
    "utf8",
  );

  it("requires review state, safe evidence, active applicant, and enriched facts", () => {
    for (const gate of [
      'row.state !== "PENDING_REVIEW"',
      'applicant.state !== "ACTIVE"',
      'evidence.malwareStatus !== "PASS"',
      'evidence.typeStatus !== "PASS"',
      'evidence.structureStatus !== "PASS"',
      'evidence.previewStatus !== "PASS"',
      'input.decision === "APPROVE" && row.submissionIdempotencyKey',
      "if (!row.businessFacts)",
    ]) {
      expect(source).toContain(gate);
    }
    expect(source).not.toMatch(/registry.*outcome.*APPROVED/iu);
  });
});
