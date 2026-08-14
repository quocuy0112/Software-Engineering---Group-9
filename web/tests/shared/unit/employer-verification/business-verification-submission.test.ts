import { describe, expect, it } from "vitest";
import { enrichedVerificationSubmissionSchema } from "@/shared/contracts/employer-verification/business-verification";

const valid = {
  preparationId: "prep",
  preparationVersion: "2",
  lookupSnapshotId: "snapshot",
  taxIdentifier: "0316794479",
  applicantLegalName: "Example Company",
  applicantRegisteredAddress: "123 Nguyen Hue, Ho Chi Minh City",
  operatingAddressDiffers: "false",
  companyPhone: "0901234567",
  relationship: "LEGAL_OWNER",
  currentJobTitle: "Owner",
  accuracyDeclaration: "true",
  documentProcessingConsent: "true",
  policyVersion: "business-verification-consent-v1",
  requestedRole: "RECRUITER",
};

describe("enriched verification submission", () => {
  it("normalizes accepted multipart values before persistence", () => {
    const parsed = enrichedVerificationSubmissionSchema.parse({
      ...valid,
      applicantLegalName: "  Example   Company  ",
      companyPhone: "0901 234 567",
      website: "www.example.vn/",
    });
    expect(parsed.applicantLegalName).toBe("Example Company");
    expect(parsed.companyPhone).toBe("+84901234567");
    expect(parsed.website).toBe("https://example.vn");
  });

  it("reports conditional operating-address and authority issues", () => {
    const result = enrichedVerificationSubmissionSchema.safeParse({
      ...valid,
      operatingAddressDiffers: "true",
      relationship: "AUTHORIZED_EMPLOYEE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["operatingAddress", "authorityExplanation"]),
      );
    }
  });
});
