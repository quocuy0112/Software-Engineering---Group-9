import { describe, expect, it } from "vitest";
import {
  businessFactsDiffer,
  businessTaxIdentifierSchema,
  companyPhoneSchema,
  companyWebsiteSchema,
  enrichedVerificationSubmissionSchema,
  normalizeBusinessPlainText,
} from "@/shared/contracts/employer-verification/business-verification";

describe("business verification normalization", () => {
  it("retains a leading zero and rejects non-ASCII or branch tax identifiers", () => {
    expect(businessTaxIdentifierSchema.parse(" 0316794479 ")).toBe("0316794479");
    expect(businessTaxIdentifierSchema.parse("0109934230")).toBe("0109934230");
    expect(businessTaxIdentifierSchema.safeParse("0316794479001").success).toBe(false);
    expect(businessTaxIdentifierSchema.safeParse("０316794479").success).toBe(false);
  });

  it("stores supported Vietnamese phones in canonical +84 form", () => {
    expect(companyPhoneSchema.parse("0901 234 567")).toBe("+84901234567");
    expect(companyPhoneSchema.parse("+84 (901) 234-567")).toBe("+84901234567");
    expect(companyPhoneSchema.safeParse("+1 202 555 0100").success).toBe(false);
    expect(companyPhoneSchema.safeParse("0901234567 ext 4").success).toBe(false);
  });

  it("normalizes only safe public HTTPS origins", () => {
    expect(companyWebsiteSchema.parse("www.Example.vn/")).toBe("https://example.vn");
    expect(companyWebsiteSchema.safeParse("http://example.vn").success).toBe(false);
    expect(companyWebsiteSchema.safeParse("https://user@example.vn").success).toBe(false);
    expect(companyWebsiteSchema.safeParse("https://127.0.0.1").success).toBe(false);
  });

  it("removes markup and detects every exact normalized difference", () => {
    expect(normalizeBusinessPlainText("  CÔNG TY <b>ABC</b>  ")).toBe("CÔNG TY ABC");
    expect(businessFactsDiffer("Công ty ABC", " Công ty   ABC ")).toBe(false);
    expect(businessFactsDiffer("Công ty ABC", "Công ty ABD")).toBe(true);
  });

  it("requires conditional authority explanation", () => {
    const base = {
      preparationId: "prep-1",
      preparationVersion: 1,
      lookupSnapshotId: "snapshot-1",
      taxIdentifier: "0316794479",
      applicantLegalName: "Công ty ABC",
      applicantRegisteredAddress: "123 Nguyễn Huệ, Thành phố Hồ Chí Minh",
      operatingAddressDiffers: false,
      companyPhone: "0901234567",
      relationship: "AUTHORIZED_EMPLOYEE",
      currentJobTitle: "HR Manager",
      accuracyDeclaration: "true",
      documentProcessingConsent: "true",
      policyVersion: "business-verification-consent-v1",
      requestedRole: "RECRUITER",
    };
    expect(enrichedVerificationSubmissionSchema.safeParse(base).success).toBe(false);
    expect(enrichedVerificationSubmissionSchema.safeParse({ ...base, authorityExplanation: "I am authorized to recruit for the company." }).success).toBe(true);
  });

  it("parses multipart booleans without treating false as true", () => {
    const result = enrichedVerificationSubmissionSchema.safeParse({
      preparationId: "prep-1",
      preparationVersion: "1",
      lookupSnapshotId: "snapshot-1",
      taxIdentifier: "0316794479",
      applicantLegalName: "Company ABC",
      applicantRegisteredAddress: "123 Nguyen Hue, Ho Chi Minh City",
      operatingAddressDiffers: "false",
      companyPhone: "0901234567",
      relationship: "LEGAL_OWNER",
      currentJobTitle: "Owner",
      accuracyDeclaration: "true",
      documentProcessingConsent: "true",
      policyVersion: "business-verification-consent-v1",
      requestedRole: "RECRUITER",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.operatingAddressDiffers).toBe(false);
  });
});
