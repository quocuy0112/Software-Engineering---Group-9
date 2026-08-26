import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/backend/database/prisma";

const fixture = vi.hoisted(() => ({
  userId: `enriched-submit-${crypto.randomUUID()}`,
  adminId: `enriched-submit-admin-${crypto.randomUUID()}`,
  deleted: vi.fn(),
}));

vi.mock("@/backend/auth/session/require-session", () => ({
  requireSession: async () => ({
    userId: fixture.userId,
    sessionId: "session-014",
  }),
}));
vi.mock("@/backend/storage/business-evidence/filesystem", () => ({
  FilesystemPrivateBusinessEvidenceStorage: class {
    async write(key: string, bytes: Buffer) {
      return {
        byteSize: bytes.byteLength,
        sourceSha256: "a".repeat(64),
        storageAdapter: "filesystem",
        storageLocator: `test/${key}`,
        encryptionKeyVersion: 1,
        iv: "test-iv",
        authenticationTag: "test-tag",
      };
    }
    async delete(locator: string) {
      fixture.deleted(locator);
    }
  },
}));

import { ApplicantVerificationService } from "@/backend/admin/verification/applicant-verification-service";

const taxIdentifier = `8${String(Date.now()).slice(-9)}`;
const snapshotId = `snapshot-${fixture.userId}`;
const preparationId = `preparation-${fixture.userId}`;
const challengeId = `challenge-${fixture.userId}`;
const adminGrantId = `grant-${fixture.adminId}`;
const now = new Date();

const raw = {
  preparationId,
  preparationVersion: 1,
  lookupSnapshotId: snapshotId,
  taxIdentifier,
  applicantLegalName: "Example Company",
  applicantRegisteredAddress: "123 Nguyen Hue, Ho Chi Minh City",
  operatingAddressDiffers: false,
  companyPhone: "0901234567",
  website: "example.vn",
  relationship: "LEGAL_OWNER",
  currentJobTitle: "Owner",
  accuracyDeclaration: "true",
  documentProcessingConsent: "true",
  policyVersion: "business-verification-consent-v1",
  requestedRole: "OWNER",
};

describe("enriched employer verification submission transaction", () => {
  beforeAll(async () => {
    await prisma.userAccount.create({
      data: {
        id: fixture.userId,
        name: "Submission Applicant",
        email: `${fixture.userId}@example.test`,
        normalizedEmail: `${fixture.userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await prisma.userAccount.create({
      data: {
        id: fixture.adminId,
        name: "Verification Administrator",
        email: `${fixture.adminId}@example.test`,
        normalizedEmail: `${fixture.adminId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
        platformAdministratorGrants: { create: { id: adminGrantId } },
      },
    });
    await prisma.businessRegistryLookupSnapshot.create({
      data: {
        id: snapshotId,
        applicantUserId: fixture.userId,
        normalizedTaxIdentifier: taxIdentifier,
        providerKey: "vietqr-v2",
        outcome: "MATCHED",
        registryLegalName: "Example Company",
        registryRegisteredAddress: "123 Nguyen Hue, Ho Chi Minh City",
        responseDigest: "b".repeat(64),
        checkedAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
        deleteAfter: new Date(now.getTime() + 172_800_000),
      },
    });
    await prisma.employerVerificationPreparation.create({
      data: {
        id: preparationId,
        applicantUserId: fixture.userId,
        lookupSnapshotId: snapshotId,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
    });
    await prisma.companyContactEmailChallenge.create({
      data: {
        id: challengeId,
        applicantUserId: fixture.userId,
        lookupSnapshotId: snapshotId,
        normalizedTaxIdentifier: taxIdentifier,
        normalizedEmail: "hr@example.vn",
        emailDigest: "c".repeat(64),
        state: "VERIFIED",
        expiresAt: new Date(now.getTime() + 86_400_000),
        verifiedAt: now,
        metadataDeleteAfter: new Date(now.getTime() + 2_592_000_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.inAppNotification.deleteMany({
      where: { recipientUserId: fixture.adminId },
    });
    await prisma.emailOutbox.deleteMany({ where: { userId: fixture.userId } });
    await prisma.recruiterVerificationRequest.deleteMany({
      where: { applicantUserId: fixture.userId },
    });
    await prisma.companyContactEmailChallenge.deleteMany({
      where: { applicantUserId: fixture.userId },
    });
    await prisma.employerVerificationPreparation.deleteMany({
      where: { applicantUserId: fixture.userId },
    });
    await prisma.businessRegistryLookupSnapshot.deleteMany({
      where: { applicantUserId: fixture.userId },
    });
    await prisma.platformAdministratorGrant.deleteMany({
      where: { id: adminGrantId },
    });
    await prisma.userAccount.deleteMany({ where: { id: fixture.adminId } });
    await prisma.userAccount.deleteMany({ where: { id: fixture.userId } });
  });

  it("rejects direct final submission when the registry did not confirm a record", async () => {
    await prisma.businessRegistryLookupSnapshot.update({
      where: { id: snapshotId },
      data: { outcome: "UNAVAILABLE" },
    });
    const file = {
      size: 8,
      type: "application/pdf",
      arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7\n").buffer,
    } as File;
    await expect(
      new ApplicantVerificationService().submit(
        new Request("http://localhost/api/employer-verifications"),
        raw,
        file,
        `submission:${crypto.randomUUID()}`,
      ),
    ).rejects.toThrow("LOOKUP_REQUIRED");
    await prisma.businessRegistryLookupSnapshot.update({
      where: { id: snapshotId },
      data: { outcome: "MATCHED" },
    });
  });

  it("commits one atomic request and replays concurrent idempotent submissions", async () => {
    const idempotencyKey = `submission:${crypto.randomUUID()}`;
    const file = () =>
      ({
        size: 8,
        type: "application/pdf",
        arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7\n").buffer,
      }) as File;
    const service = new ApplicantVerificationService();
    const [result, replay] = await Promise.all([
      service.submit(
        new Request("http://localhost/api/employer-verifications"),
        raw,
        file(),
        idempotencyKey,
      ),
      service.submit(
        new Request("http://localhost/api/employer-verifications"),
        raw,
        file(),
        idempotencyKey,
      ),
    ]);
    expect(replay.requestId).toBe(result.requestId);
    const request = await prisma.recruiterVerificationRequest.findUniqueOrThrow(
      {
        where: { id: result.requestId },
        include: { businessFacts: true, evidence: true },
      },
    );
    expect(request.requestedRole).toBe("OWNER");
    expect(request.businessFacts).toMatchObject({
      companyEmail: "hr@example.vn",
      companyPhoneE164: "+84901234567",
      companyPhoneVerified: false,
    });
    expect(request.evidence).toHaveLength(1);
    expect(
      (
        await prisma.companyContactEmailChallenge.findUniqueOrThrow({
          where: { id: challengeId },
        })
      ).state,
    ).toBe("CONSUMED");
    expect(
      await prisma.emailOutbox.count({
        where: { verificationRequestId: result.requestId },
      }),
    ).toBe(1);
    await expect(
      prisma.inAppNotification.findMany({
        where: {
          recipientUserId: fixture.adminId,
          contextType: "VERIFICATION_REQUEST",
          contextId: result.requestId,
        },
      }),
    ).resolves.toMatchObject([
      {
        kind: "VERIFICATION_RECEIVED",
        title: "Verification received",
        summary:
          "A new business verification request was submitted and is awaiting review.",
      },
    ]);
  });
});
