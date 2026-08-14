import "server-only";
import { prisma } from "@/backend/database/prisma";
import type {
  EmployerVerificationPreparationRepository,
  VerificationPreparationDraftChanges,
} from "@/backend/admin/verification/employer-verification-preparation-repository";

export class PrismaEmployerVerificationPreparationRepository implements EmployerVerificationPreparationRepository {
  async isActiveUser(userId: string) {
    return Boolean(
      await prisma.userAccount.findFirst({
        where: { id: userId, state: "ACTIVE", deletedAt: null },
        select: { id: true },
      }),
    );
  }

  async hasReusableLookup(
    input: Parameters<
      EmployerVerificationPreparationRepository["hasReusableLookup"]
    >[0],
  ) {
    return Boolean(
      await prisma.employerVerificationPreparation.findFirst({
        where: {
          applicantUserId: input.userId,
          inaccessibleAt: null,
          expiresAt: { gt: input.now },
          lookupSnapshot: {
            normalizedTaxIdentifier: input.taxIdentifier,
            outcome: { in: ["MATCHED", "PARTIAL"] },
            checkedAt: { gte: input.checkedAfter },
            expiresAt: { gt: input.now },
            inaccessibleAt: null,
          },
        },
        select: { id: true },
      }),
    );
  }

  async replaceLookup(
    input: Parameters<
      EmployerVerificationPreparationRepository["replaceLookup"]
    >[0],
  ) {
    await prisma.$transaction(async (transaction) => {
      await transaction.companyContactEmailChallenge.updateMany({
        where: {
          applicantUserId: input.userId,
          state: { in: ["PENDING", "VERIFIED"] },
        },
        data: {
          state: "SUPERSEDED",
          supersededAt: input.now,
          normalizedEmail: null,
          tokenDigest: null,
          sensitiveInaccessibleAt: input.now,
          sensitiveDeleteAfter: input.sensitiveDeleteAfter,
        },
      });
      await transaction.businessRegistryLookupSnapshot.updateMany({
        where: {
          applicantUserId: input.userId,
          acceptedRequestId: null,
          inaccessibleAt: null,
        },
        data: {
          inaccessibleAt: input.now,
          deleteAfter: new Date(input.now.getTime() + 24 * 60 * 60_000),
        },
      });
      const snapshot = await transaction.businessRegistryLookupSnapshot.create({
        data: {
          applicantUserId: input.userId,
          normalizedTaxIdentifier: input.taxIdentifier,
          providerKey: input.result.providerKey,
          outcome: input.result.outcome,
          registryLegalName: input.result.facts?.legalName,
          registryInternationalName: input.result.facts?.internationalName,
          registryShortName: input.result.facts?.shortName,
          registryRegisteredAddress: input.result.facts?.registeredAddress,
          responseDigest: input.responseDigest,
          checkedAt: input.now,
          expiresAt: input.expiresAt,
          deleteAfter: input.snapshotDeleteAfter,
        },
      });
      await transaction.employerVerificationPreparation.upsert({
        where: { applicantUserId: input.userId },
        create: {
          applicantUserId: input.userId,
          lookupSnapshotId: snapshot.id,
          applicantLegalName: input.result.facts?.legalName,
          applicantRegisteredAddress: input.result.facts?.registeredAddress,
          expiresAt: input.preparationExpiresAt,
        },
        update: {
          lookupSnapshotId: snapshot.id,
          version: { increment: 1 },
          applicantLegalName: input.result.facts?.legalName ?? null,
          applicantRegisteredAddress:
            input.result.facts?.registeredAddress ?? null,
          mismatchExplanation: null,
          inaccessibleAt: null,
          deleteAfter: null,
          deletedAt: null,
          expiresAt: input.preparationExpiresAt,
        },
      });
    });
  }

  async invalidateCurrentPreparation(
    input: Parameters<
      EmployerVerificationPreparationRepository["invalidateCurrentPreparation"]
    >[0],
  ) {
    const deleteAfter = new Date(input.now.getTime() + 24 * 60 * 60_000);
    await prisma.$transaction(async (transaction) => {
      await transaction.companyContactEmailChallenge.updateMany({
        where: {
          applicantUserId: input.userId,
          state: { in: ["PENDING", "VERIFIED"] },
        },
        data: {
          state: "SUPERSEDED",
          supersededAt: input.now,
          normalizedEmail: null,
          tokenDigest: null,
          sensitiveInaccessibleAt: input.now,
          sensitiveDeleteAfter: input.sensitiveDeleteAfter,
        },
      });
      await transaction.businessRegistryLookupSnapshot.updateMany({
        where: {
          applicantUserId: input.userId,
          acceptedRequestId: null,
          inaccessibleAt: null,
        },
        data: { inaccessibleAt: input.now, deleteAfter },
      });
      await transaction.employerVerificationPreparation.updateMany({
        where: {
          applicantUserId: input.userId,
          inaccessibleAt: null,
        },
        data: { inaccessibleAt: input.now, deleteAfter },
      });
    });
  }

  async updateDraft(
    input: Parameters<
      EmployerVerificationPreparationRepository["updateDraft"]
    >[0],
  ) {
    const changes: VerificationPreparationDraftChanges = input.changes;
    const changed = await prisma.employerVerificationPreparation.updateMany({
      where: {
        id: input.preparationId,
        applicantUserId: input.userId,
        version: input.version,
        inaccessibleAt: null,
        expiresAt: { gt: input.now },
      },
      data: {
        ...(changes.applicantLegalName !== undefined
          ? { applicantLegalName: changes.applicantLegalName }
          : {}),
        ...(changes.applicantRegisteredAddress !== undefined
          ? { applicantRegisteredAddress: changes.applicantRegisteredAddress }
          : {}),
        ...(changes.operatingAddressDiffers !== undefined
          ? { operatingAddressDiffers: changes.operatingAddressDiffers }
          : {}),
        ...(changes.operatingAddress !== undefined
          ? { operatingAddress: changes.operatingAddress }
          : {}),
        ...(changes.companyPhone !== undefined
          ? { companyPhoneE164: changes.companyPhone }
          : {}),
        ...(changes.website !== undefined
          ? { websiteOrigin: changes.website }
          : {}),
        ...(changes.relationship !== undefined
          ? { relationship: changes.relationship }
          : {}),
        ...(changes.currentJobTitle !== undefined
          ? { currentJobTitle: changes.currentJobTitle }
          : {}),
        ...(changes.authorityExplanation !== undefined
          ? { authorityExplanation: changes.authorityExplanation }
          : {}),
        ...(changes.mismatchExplanation !== undefined
          ? { mismatchExplanation: changes.mismatchExplanation }
          : {}),
        version: { increment: 1 },
        expiresAt: input.expiresAt,
      },
    });
    return changed.count === 1;
  }

  findPreparationForChallenge(
    input: Parameters<
      EmployerVerificationPreparationRepository["findPreparationForChallenge"]
    >[0],
  ) {
    return prisma.employerVerificationPreparation.findFirst({
      where: {
        applicantUserId: input.userId,
        version: input.version,
        inaccessibleAt: null,
        expiresAt: { gt: input.now },
      },
      include: { lookupSnapshot: true },
    });
  }

  async issueEmailChallenge(
    input: Parameters<
      EmployerVerificationPreparationRepository["issueEmailChallenge"]
    >[0],
  ) {
    return prisma.$transaction(async (transaction) => {
      await transaction.companyContactEmailChallenge.updateMany({
        where: {
          applicantUserId: input.userId,
          lookupSnapshotId: input.snapshotId,
          state: { in: ["PENDING", "VERIFIED"] },
        },
        data: {
          state: "SUPERSEDED",
          supersededAt: input.now,
          normalizedEmail: null,
          tokenDigest: null,
          sensitiveInaccessibleAt: input.now,
          sensitiveDeleteAfter: input.sensitiveDeleteAfter,
        },
      });
      const challenge = await transaction.companyContactEmailChallenge.create({
        data: {
          applicantUserId: input.userId,
          lookupSnapshotId: input.snapshotId,
          normalizedTaxIdentifier: input.taxIdentifier,
          normalizedEmail: input.normalizedEmail,
          emailDigest: input.emailDigest,
          tokenDigest: input.tokenDigest,
          expiresAt: input.expiresAt,
          metadataDeleteAfter: input.metadataDeleteAfter,
        },
      });
      await transaction.emailOutbox.create({
        data: {
          kind: "COMPANY_EMAIL_VERIFY",
          userId: input.userId,
          companyEmailChallengeId: challenge.id,
          recipientRef: input.emailDigest,
          recipientCiphertext: input.recipientCiphertext,
          recipientPurpose: "company-email-verification.v1",
          templateVersion: "company-email-verification.v1",
          payloadRef: { protectedToken: input.protectedToken },
          idempotencyKey: `company-email:${challenge.id}`,
          status: "PENDING",
          nextAttemptAt: input.now,
        },
      });
      return challenge;
    });
  }

  findPendingEmailChallenge(
    input: Parameters<
      EmployerVerificationPreparationRepository["findPendingEmailChallenge"]
    >[0],
  ) {
    return prisma.companyContactEmailChallenge.findFirst({
      where: {
        applicantUserId: input.userId,
        tokenDigest: input.tokenDigest,
        state: "PENDING",
        expiresAt: { gt: input.now },
        lookupSnapshot: {
          expiresAt: { gt: input.now },
          currentPreparation: {
            applicantUserId: input.userId,
            inaccessibleAt: null,
          },
        },
      },
    });
  }

  async verifyEmailChallenge(
    input: Parameters<
      EmployerVerificationPreparationRepository["verifyEmailChallenge"]
    >[0],
  ) {
    const changed = await prisma.companyContactEmailChallenge.updateMany({
      where: {
        id: input.challengeId,
        tokenDigest: input.tokenDigest,
        state: "PENDING",
        expiresAt: { gt: input.now },
      },
      data: { state: "VERIFIED", verifiedAt: input.now, tokenDigest: null },
    });
    return changed.count === 1;
  }

  findCurrentPreparation(userId: string, now: Date) {
    return prisma.employerVerificationPreparation.findFirst({
      where: {
        applicantUserId: userId,
        inaccessibleAt: null,
        expiresAt: { gt: now },
      },
      include: { lookupSnapshot: true },
    });
  }

  findLatestEmailChallenge(userId: string, snapshotId: string) {
    return prisma.companyContactEmailChallenge.findFirst({
      where: {
        applicantUserId: userId,
        lookupSnapshotId: snapshotId,
        state: { in: ["PENDING", "VERIFIED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
