import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { runBusinessVerificationPreparationCleanupCycle } from "@/backend/admin/workers/verification-lifecycle-loop";

const suffix = crypto.randomUUID();
const userId = `retention-${suffix}`;
const snapshotId = `snapshot-${suffix}`;
const preparationId = `preparation-${suffix}`;
const challengeId = `challenge-${suffix}`;
const now = new Date();

describe("business verification retention", () => {
  beforeAll(async () => {
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Retention Applicant",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await prisma.businessRegistryLookupSnapshot.create({
      data: {
        id: snapshotId,
        applicantUserId: userId,
        normalizedTaxIdentifier: "0316794479",
        providerKey: "disabled-manual-v1",
        outcome: "UNAVAILABLE",
        responseDigest: "f".repeat(64),
        checkedAt: new Date(now.getTime() - 172_800_000),
        expiresAt: new Date(now.getTime() - 86_400_000),
        deleteAfter: new Date(now.getTime() + 86_400_000),
      },
    });
    await prisma.employerVerificationPreparation.create({
      data: {
        id: preparationId,
        applicantUserId: userId,
        lookupSnapshotId: snapshotId,
        expiresAt: new Date(now.getTime() - 1),
      },
    });
    await prisma.companyContactEmailChallenge.create({
      data: {
        id: challengeId,
        applicantUserId: userId,
        lookupSnapshotId: snapshotId,
        normalizedTaxIdentifier: "0316794479",
        normalizedEmail: "hr@example.vn",
        emailDigest: "1".repeat(64),
        tokenDigest: "2".repeat(64),
        expiresAt: new Date(now.getTime() - 1),
        metadataDeleteAfter: new Date(now.getTime() + 2_592_000_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.companyContactEmailChallenge.deleteMany({ where: { applicantUserId: userId } });
    await prisma.employerVerificationPreparation.deleteMany({ where: { applicantUserId: userId } });
    await prisma.businessRegistryLookupSnapshot.deleteMany({ where: { applicantUserId: userId } });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("expires and scrubs sensitive preparation data on schedule", async () => {
    await runBusinessVerificationPreparationCleanupCycle(now);
    const challenge = await prisma.companyContactEmailChallenge.findUniqueOrThrow({ where: { id: challengeId } });
    const preparation = await prisma.employerVerificationPreparation.findUniqueOrThrow({ where: { id: preparationId } });
    const snapshot = await prisma.businessRegistryLookupSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    expect(challenge).toMatchObject({ state: "EXPIRED", normalizedEmail: null, tokenDigest: null });
    expect(challenge.sensitiveInaccessibleAt).toEqual(now);
    expect(preparation.inaccessibleAt).toEqual(now);
    expect(snapshot.inaccessibleAt).toEqual(now);
  });
});
