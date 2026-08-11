import { describe, expect, it } from "vitest";
import { assertVerificationTransition, normalizedTaxIdentifierSchema, validateEvidenceFile, verificationTransitions } from "@/shared/contracts/admin/verification";

describe("employer verification rules", () => {
  it.each(["0123456789", " 0123456789 "])("accepts the exact normalized tax identifier %s", (value) => expect(normalizedTaxIdentifierSchema.parse(value)).toBe("0123456789"));
  it.each(["012 3456789", "012-3456789", "０１２３４５６７８９", "123", ""])("rejects invalid tax identifier %s", (value) => expect(() => normalizedTaxIdentifierSchema.parse(value)).toThrow());
  it("accepts only 1-5,000,000 byte PDF/PNG/JPEG evidence", () => {
    expect(validateEvidenceFile({ size: 1, type: "application/pdf" })).toBe("application/pdf");
    expect(() => validateEvidenceFile({ size: 5_000_001, type: "image/png" })).toThrow();
    expect(() => validateEvidenceFile({ size: 10, type: "text/plain" })).toThrow();
  });
  it("has only the approved state transitions and terminal states", () => {
    expect(verificationTransitions.APPROVED).toEqual([]);
    expect(() => assertVerificationTransition("PENDING_CHECKS", "PENDING_REVIEW")).not.toThrow();
    expect(() => assertVerificationTransition("REJECTED", "PENDING_CHECKS")).toThrow();
  });
});
