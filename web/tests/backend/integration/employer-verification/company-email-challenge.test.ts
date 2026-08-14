import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaEmployerVerificationPreparationRepository } from "@/backend/repositories/admin/prisma-employer-verification-preparation-repository";

const suffix = crypto.randomUUID();
const userId = `company-email-${suffix}`;
const repository = new PrismaEmployerVerificationPreparationRepository();
const now = new Date();
let snapshotId = "";

describe("company email challenge concurrency", () => {
  beforeAll(async () => {
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Email Applicant",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
    await repository.replaceLookup({
      userId,
      taxIdentifier: "0316794479",
      result: { providerKey: "disabled-manual-v1", outcome: "UNAVAILABLE", facts: null },
      responseDigest: "b".repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      snapshotDeleteAfter: new Date(now.getTime() + 172_800_000),
      preparationExpiresAt: new Date(now.getTime() + 172_800_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_400_000),
    });
    snapshotId = (await repository.findCurrentPreparation(userId, now))!.lookupSnapshotId!;
  });

  afterAll(async () => {
    await prisma.emailOutbox.deleteMany({ where: { userId } });
    await prisma.companyContactEmailChallenge.deleteMany({ where: { applicantUserId: userId } });
    await prisma.employerVerificationPreparation.deleteMany({ where: { applicantUserId: userId } });
    await prisma.businessRegistryLookupSnapshot.deleteMany({ where: { applicantUserId: userId } });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("supersedes resend and permits exactly one concurrent token consume", async () => {
    const first = await repository.issueEmailChallenge({
      userId,
      snapshotId,
      taxIdentifier: "0316794479",
      normalizedEmail: "hr@example.vn",
      emailDigest: "c".repeat(64),
      tokenDigest: "d".repeat(64),
      protectedToken: "protected-first",
      recipientCiphertext: "ciphertext-first",
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_400_000),
      metadataDeleteAfter: new Date(now.getTime() + 2_592_000_000),
    });
    const second = await repository.issueEmailChallenge({
      userId,
      snapshotId,
      taxIdentifier: "0316794479",
      normalizedEmail: "hr@example.vn",
      emailDigest: "c".repeat(64),
      tokenDigest: "e".repeat(64),
      protectedToken: "protected-second",
      recipientCiphertext: "ciphertext-second",
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_400_000),
      metadataDeleteAfter: new Date(now.getTime() + 2_592_000_000),
    });
    expect((await prisma.companyContactEmailChallenge.findUnique({ where: { id: first.id } }))?.state).toBe("SUPERSEDED");
    expect(await prisma.emailOutbox.count({ where: { userId } })).toBe(2);
    expect(
      await repository.findPendingEmailChallenge({
        userId: "different-user",
        tokenDigest: "e".repeat(64),
        now,
      }),
    ).toBeNull();
    expect(
      await repository.findPendingEmailChallenge({
        userId,
        tokenDigest: "e".repeat(64),
        now: new Date(now.getTime() + 172_800_000),
      }),
    ).toBeNull();
    const results = await Promise.all([
      repository.verifyEmailChallenge({ challengeId: second.id, tokenDigest: "e".repeat(64), now }),
      repository.verifyEmailChallenge({ challengeId: second.id, tokenDigest: "e".repeat(64), now }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
