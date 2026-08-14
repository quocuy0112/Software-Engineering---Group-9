import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaVerificationRepository } from "@/backend/repositories/admin/prisma-verification-repository";

const suffix = crypto.randomUUID();
const userId = `admin-detail-${suffix}`;
const requestId = `request-${suffix}`;
const snapshotId = `snapshot-${suffix}`;
const taxIdentifier = `9${String(Date.now()).slice(-9)}`;

describe("administrator enriched detail projection", () => {
  beforeAll(async () => {
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Admin Detail Applicant",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await prisma.recruiterVerificationRequest.create({
      data: {
        id: requestId,
        submissionIdempotencyKey: `detail:${crypto.randomUUID()}`,
        applicantUserId: userId,
        submittedCompanyName: "Applicant Company",
        normalizedTaxIdentifier: taxIdentifier,
        requestedRole: "RECRUITER",
        state: "REJECTED",
      },
    });
    await prisma.businessRegistryLookupSnapshot.create({
      data: {
        id: snapshotId,
        applicantUserId: userId,
        normalizedTaxIdentifier: taxIdentifier,
        providerKey: "vietqr-v2",
        outcome: "MATCHED",
        registryLegalName: "Registry Company",
        registryRegisteredAddress: "Registry Address",
        responseDigest: "7".repeat(64),
        checkedAt: new Date("2026-08-14T00:00:00.000Z"),
        expiresAt: new Date("2026-08-15T00:00:00.000Z"),
        acceptedRequestId: requestId,
        acceptedAt: new Date("2026-08-14T01:00:00.000Z"),
      },
    });
    await prisma.verificationBusinessFacts.create({
      data: {
        requestId,
        lookupSnapshotId: snapshotId,
        applicantLegalName: "Applicant Company",
        applicantRegisteredAddress: "Applicant Address",
        companyEmail: "hr@example.vn",
        companyEmailVerifiedAt: new Date("2026-08-14T01:00:00.000Z"),
        companyEmailFreeProvider: false,
        companyEmailWebsiteDomainMatch: true,
        emailSignalVersion: "company-email-signals-v1",
        companyPhoneE164: "+84901234567",
        websiteOrigin: "https://example.vn",
        relationship: "LEGAL_OWNER",
        currentJobTitle: "Owner",
        legalNameDiffers: true,
        registeredAddressDiffers: true,
        mismatchExplanation: "Registry information has not been updated yet.",
        accuracyDeclaredAt: new Date("2026-08-14T01:00:00.000Z"),
        documentConsentAt: new Date("2026-08-14T01:00:00.000Z"),
        policyVersion: "business-verification-consent-v1",
        normalizationVersion: "business-verification-v1",
      },
    });
  });

  afterAll(async () => {
    await prisma.recruiterVerificationRequest.deleteMany({ where: { id: requestId } });
    await prisma.businessRegistryLookupSnapshot.deleteMany({ where: { applicantUserId: userId } });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("returns bounded comparison facts without provider/token/storage internals", async () => {
    const detail = await new PrismaVerificationRepository().detail(requestId);
    expect(detail).toMatchObject({
      legacyRequest: false,
      enrichmentStatus: "COMPLETE",
      businessFacts: {
        applicantLegalName: "Applicant Company",
        companyPhoneVerified: false,
        registry: { legalName: "Registry Company", outcome: "MATCHED" },
      },
    });
    expect(JSON.stringify(detail)).not.toMatch(/tokenDigest|recipientCiphertext|storageLocator/gu);
  });
});
