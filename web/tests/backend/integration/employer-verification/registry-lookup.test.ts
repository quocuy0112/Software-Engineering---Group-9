import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaEmployerVerificationPreparationRepository } from "@/backend/repositories/admin/prisma-employer-verification-preparation-repository";

const suffix = crypto.randomUUID();
const userId = `business-lookup-${suffix}`;
const repository = new PrismaEmployerVerificationPreparationRepository();
const now = new Date();

describe("business registry preparation persistence", () => {
  beforeAll(async () => {
    await prisma.userAccount.create({
      data: {
        id: userId,
        name: "Business Applicant",
        email: `${userId}@example.test`,
        normalizedEmail: `${userId}@example.test`,
        emailVerified: true,
        state: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.emailOutbox.deleteMany({ where: { userId } });
    await prisma.companyContactEmailChallenge.deleteMany({
      where: { applicantUserId: userId },
    });
    await prisma.employerVerificationPreparation.deleteMany({
      where: { applicantUserId: userId },
    });
    await prisma.businessRegistryLookupSnapshot.deleteMany({
      where: { applicantUserId: userId },
    });
    await prisma.userAccount.deleteMany({ where: { id: userId } });
  });

  it("stores an immutable allowlisted snapshot and applicant-bound draft", async () => {
    await repository.replaceLookup({
      userId,
      taxIdentifier: "0316794479",
      result: {
        providerKey: "vietqr-v2",
        outcome: "MATCHED",
        facts: {
          taxIdentifier: "0316794479",
          legalName: "Example Company",
          internationalName: null,
          shortName: null,
          registeredAddress: "123 Nguyen Hue, Ho Chi Minh City",
        },
      },
      responseDigest: "a".repeat(64),
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
      snapshotDeleteAfter: new Date(now.getTime() + 172_800_000),
      preparationExpiresAt: new Date(now.getTime() + 172_800_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_400_000),
    });

    const preparation = await repository.findCurrentPreparation(userId, now);
    expect(preparation?.lookupSnapshot?.registryLegalName).toBe(
      "Example Company",
    );
    expect(preparation?.applicantRegisteredAddress).toContain("Nguyen Hue");
    expect(preparation?.requestedRole).toBe("RECRUITER");
    expect(
      await repository.updateDraft({
        userId,
        preparationId: preparation!.id,
        version: preparation!.version,
        changes: { requestedRole: "OWNER" },
        now,
        expiresAt: new Date(now.getTime() + 172_800_000),
      }),
    ).toBe(true);
    expect(
      (await repository.findCurrentPreparation(userId, now))?.requestedRole,
    ).toBe("OWNER");
    expect(
      await repository.hasReusableLookup({
        userId,
        taxIdentifier: "0316794479",
        checkedAfter: new Date(now.getTime() - 900_000),
        now,
      }),
    ).toBe(true);
  });

  it("enforces applicant ownership and optimistic draft versions", async () => {
    const preparation = await repository.findCurrentPreparation(userId, now);
    expect(preparation).not.toBeNull();
    expect(
      await repository.updateDraft({
        userId: "different-user",
        preparationId: preparation!.id,
        version: preparation!.version,
        changes: { companyPhone: "+84901234567" },
        now,
        expiresAt: new Date(now.getTime() + 172_800_000),
      }),
    ).toBe(false);
    expect(
      await repository.updateDraft({
        userId,
        preparationId: preparation!.id,
        version: preparation!.version,
        changes: { companyPhone: "+84901234567" },
        now,
        expiresAt: new Date(now.getTime() + 172_800_000),
      }),
    ).toBe(true);
    expect(
      await repository.updateDraft({
        userId,
        preparationId: preparation!.id,
        version: preparation!.version,
        changes: { companyPhone: "+84909999999" },
        now,
        expiresAt: new Date(now.getTime() + 172_800_000),
      }),
    ).toBe(false);
  });

  it("keeps old snapshots immutable and invalidates them on tax change", async () => {
    const previous = await repository.findCurrentPreparation(userId, now);
    const previousSnapshotId = previous!.lookupSnapshotId!;
    await repository.replaceLookup({
      userId,
      taxIdentifier: "0316794480",
      result: {
        providerKey: "disabled-manual-v1",
        outcome: "UNAVAILABLE",
        facts: null,
      },
      responseDigest: "3".repeat(64),
      now: new Date(now.getTime() + 1_000),
      expiresAt: new Date(now.getTime() + 86_401_000),
      snapshotDeleteAfter: new Date(now.getTime() + 172_801_000),
      preparationExpiresAt: new Date(now.getTime() + 172_801_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_401_000),
    });
    const oldSnapshot =
      await prisma.businessRegistryLookupSnapshot.findUniqueOrThrow({
        where: { id: previousSnapshotId },
      });
    expect(oldSnapshot.registryLegalName).toBe("Example Company");
    expect(oldSnapshot.inaccessibleAt).not.toBeNull();
    expect(
      (await repository.findCurrentPreparation(userId, now))?.lookupSnapshot
        ?.normalizedTaxIdentifier,
    ).toBe("0316794480");
  });

  it("invalidates all current progress before the identifier can change", async () => {
    await repository.invalidateCurrentPreparation({
      userId,
      now: new Date(now.getTime() + 2_000),
      sensitiveDeleteAfter: new Date(now.getTime() + 86_402_000),
    });
    expect(
      await repository.findCurrentPreparation(
        userId,
        new Date(now.getTime() + 2_000),
      ),
    ).toBeNull();
  });

  it("keeps documented account and identifier admission limits", () => {
    const service = readFileSync(
      "src/backend/admin/verification/employer-verification-preparation-service.ts",
      "utf8",
    );
    expect(service).toContain(
      '"business-registry-account", userId, 10, 15 * 60',
    );
    expect(service).toContain('"business-registry-identifier"');
    expect(service).toContain("30,");
  });
});
