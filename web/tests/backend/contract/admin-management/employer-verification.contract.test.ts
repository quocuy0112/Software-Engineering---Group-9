import { describe, expect, it } from "vitest";
import {
  businessEvidenceMediaTypeSchema,
  normalizedTaxIdentifierSchema,
  validateEvidenceFile,
  verificationDecisionSchema,
  verificationListFilterSchema,
  verificationSubmissionSchema,
} from "@/shared/contracts/admin/verification";
import { adminContractPaths } from "@/shared/contracts/admin/generated";

describe("employer verification contract", () => {
  it("keeps every applicant, review, evidence, and decision path explicit", () => {
    expect(adminContractPaths).toEqual(
      expect.arrayContaining([
        "/api/employer-verifications",
        "/api/employer-verifications/{requestId}/{action}",
        "/api/admin/verification-requests",
        "/api/admin/verification-requests/{requestId}",
        "/api/admin/verification-requests/{requestId}/evidence/{evidenceId}/preview",
        "/api/admin/verification-requests/{requestId}/evidence/{evidenceId}/download",
        "/api/admin/verification-requests/{requestId}/request-changes",
        "/api/admin/verification-requests/{requestId}/reject",
        "/api/admin/verification-requests/{requestId}/approve",
      ]),
    );
  });

  it("accepts only exact tax IDs, file media types, and strict submission fields", () => {
    expect(normalizedTaxIdentifierSchema.parse(" 0123456789 ")).toBe(
      "0123456789",
    );
    for (const value of [
      "012 3456789",
      "０123456789",
      "012345678",
      "01234567890",
    ])
      expect(normalizedTaxIdentifierSchema.safeParse(value).success).toBe(
        false,
      );
    expect(businessEvidenceMediaTypeSchema.options).toEqual([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]);
    expect(() =>
      validateEvidenceFile({ size: 0, type: "application/pdf" }),
    ).toThrow();
    expect(() =>
      validateEvidenceFile({ size: 5_000_001, type: "image/png" }),
    ).toThrow();
    expect(
      verificationSubmissionSchema.safeParse({
        companyName: "Example Company",
        taxIdentifier: "0123456789",
        requestedRole: "RECRUITER",
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("accepts recruiter applications only", () => {
    for (const requestedRole of ["OWNER", "HR_MANAGER", "HIRING_MANAGER"]) {
      expect(
        verificationSubmissionSchema.safeParse({
          companyName: "Example Company",
          taxIdentifier: "0123456789",
          requestedRole,
        }).success,
      ).toBe(false);
    }
  });
  it("constrains queue filters and every administrator decision payload", () => {
    expect(
      verificationListFilterSchema.safeParse({
        assignment: "UNASSIGNED",
        unknown: 1,
      }).success,
    ).toBe(false);
    expect(
      verificationDecisionSchema.parse({
        action: "reject",
        confirmation: true,
        category: "DOCUMENT_UNREADABLE",
        reason: "The submitted document cannot be verified.",
      }).action,
    ).toBe("reject");
    expect(
      verificationDecisionSchema.safeParse({
        action: "request-changes",
        confirmation: true,
        guidance: "short",
      }).success,
    ).toBe(false);
  });
});
