import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  validateEvidenceFile,
} from "@/shared/contracts/admin/verification";
import {
  businessFactsDiffer,
  enrichedVerificationSubmissionSchema,
} from "@/shared/contracts/employer-verification/business-verification";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { S3PrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/s3";
import { CompanyRelationshipPrerequisiteGateway } from "./company-relationship-prerequisite-gateway";
import { buildVerificationOutbox } from "@/backend/admin/notifications/verification-outbox";
import { businessVerificationConfig } from "./business-verification-config";
import { companyEmailSignals } from "./company-email-verification";
function storage() {
  return process.env.ADMIN_EVIDENCE_STORAGE_ADAPTER === "s3"
    ? new S3PrivateBusinessEvidenceStorage()
    : new FilesystemPrivateBusinessEvidenceStorage();
}
function receiptData(
  requestId: string,
  userId: string,
  state: string,
  eventKind: "VERIFICATION_RECEIPT" | "VERIFICATION_CANCELLED",
  resultingVersion: number,
  occurredAt: Date,
) {
  return buildVerificationOutbox({
    requestId,
    userId,
    eventKind,
    resultingState: state,
    resultingVersion,
    occurredAt,
    nextAction:
      state === "CANCELLED" ? "SUBMIT_NEW_REQUEST" : "WAIT_FOR_REVIEW",
  });
}
export class ApplicantVerificationService {
  async list(request: Request) {
    const session = await requireSession(request.headers, new Date());
    if (!session) throw new Error("UNAUTHORIZED");
    return prisma.recruiterVerificationRequest.findMany({
      where: { applicantUserId: session.userId },
      select: {
        id: true,
        submittedCompanyName: true,
        normalizedTaxIdentifier: true,
        requestedRole: true,
        state: true,
        currentSubmissionVersion: true,
        resubmissionCount: true,
        createdAt: true,
        updatedAt: true,
        businessFacts: {
          select: {
            lookupSnapshot: { select: { outcome: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }).then((rows) =>
      rows.map(({ businessFacts, ...row }) => ({
        ...row,
        legacyRequest: !businessFacts,
        registryOutcome: businessFacts?.lookupSnapshot.outcome ?? null,
      })),
    );
  }
  async submit(
    request: Request,
    raw: unknown,
    file: File,
    idempotencyKey: string,
  ) {
    const now = new Date();
    const session = await requireSession(request.headers, now);
    if (!session) throw new Error("UNAUTHORIZED");
    const input = enrichedVerificationSubmissionSchema.parse(raw);
    if (!/^[A-Za-z0-9._:-]{16,128}$/u.test(idempotencyKey)) {
      throw new Error("IDEMPOTENCY_KEY_INVALID");
    }
    if (input.policyVersion !== businessVerificationConfig.policyVersion) {
      throw new Error("POLICY_VERSION_INVALID");
    }
    const replay = await prisma.recruiterVerificationRequest.findUnique({
      where: { submissionIdempotencyKey: idempotencyKey },
    });
    if (replay) {
      if (replay.applicantUserId !== session.userId) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }
      return { requestId: replay.id, state: replay.state, version: replay.version };
    }
    const mediaType = validateEvidenceFile(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const requestId = randomUUID();
    const preparation = await prisma.employerVerificationPreparation.findFirst({
      where: {
        id: input.preparationId,
        applicantUserId: session.userId,
        version: input.preparationVersion,
        lookupSnapshotId: input.lookupSnapshotId,
        inaccessibleAt: null,
        expiresAt: { gt: now },
      },
      include: {
        lookupSnapshot: true,
      },
    });
    if (
      !preparation?.lookupSnapshot ||
      preparation.lookupSnapshot.normalizedTaxIdentifier !==
        input.taxIdentifier ||
      preparation.lookupSnapshot.expiresAt <= now ||
      preparation.lookupSnapshot.acceptedRequestId
    ) {
      throw new Error("LOOKUP_REQUIRED");
    }
    const lookupSnapshot = preparation.lookupSnapshot;
    const challenge = await prisma.companyContactEmailChallenge.findFirst({
      where: {
        applicantUserId: session.userId,
        lookupSnapshotId: input.lookupSnapshotId,
        normalizedTaxIdentifier: input.taxIdentifier,
        state: "VERIFIED",
        verifiedAt: {
          gt: new Date(
            now.getTime() - businessVerificationConfig.challengeLifetimeMs,
          ),
        },
        expiresAt: { gt: now },
        normalizedEmail: { not: null },
      },
      orderBy: { verifiedAt: "desc" },
    });
    if (!challenge?.normalizedEmail || !challenge.verifiedAt) {
      throw new Error("EMAIL_VERIFICATION_REQUIRED");
    }
    const companyEmail = challenge.normalizedEmail;
    const companyEmailVerifiedAt = challenge.verifiedAt;
    const legalNameDiffers = businessFactsDiffer(
      input.applicantLegalName,
      lookupSnapshot.registryLegalName,
    );
    const registeredAddressDiffers = businessFactsDiffer(
      input.applicantRegisteredAddress,
      lookupSnapshot.registryRegisteredAddress,
    );
    if (
      (legalNameDiffers || registeredAddressDiffers) &&
      !input.mismatchExplanation
    ) {
      throw new Error("MISMATCH_EXPLANATION_REQUIRED");
    }
    const emailSignals = companyEmailSignals(
      companyEmail,
      input.website,
    );
    const existing = await prisma.company.findUnique({
      where: { normalizedTaxIdentifier: input.taxIdentifier },
    });
    if (existing) {
      if (input.targetCompanyId !== existing.id)
        throw new Error("TARGET_UNAVAILABLE");
      await prisma.$transaction((tx) =>
        new CompanyRelationshipPrerequisiteGateway().require(tx, {
          prerequisiteId: input.prerequisiteId,
          applicantUserId: session.userId,
          companyId: existing.id,
          requestedRole: input.requestedRole,
          now,
        }),
      );
      const membership = await prisma.companyMembership.findFirst({
        where: {
          companyId: existing.id,
          userId: session.userId,
          status: "ACTIVE",
        },
      });
      if (membership) throw new Error("DUPLICATE_AUTHORITY");
    }
    const stored = await storage().write(`${requestId}:1`, bytes);
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.recruiterVerificationRequest.create({
          data: {
            id: requestId,
            submissionIdempotencyKey: idempotencyKey,
            applicantUserId: session.userId,
            submittedCompanyName: input.applicantLegalName,
            normalizedTaxIdentifier: input.taxIdentifier,
            targetCompanyId: existing?.id,
            requestedRole: input.requestedRole,
            prerequisiteId: input.prerequisiteId,
          },
        });
        const consumed = await tx.companyContactEmailChallenge.updateMany({
          where: {
            id: challenge.id,
            state: "VERIFIED",
            expiresAt: { gt: now },
            normalizedEmail: challenge.normalizedEmail,
          },
          data: {
            state: "CONSUMED",
            consumedAt: now,
            sensitiveInaccessibleAt: now,
            sensitiveDeleteAfter: new Date(
              now.getTime() + businessVerificationConfig.sensitiveScrubDelayMs,
            ),
          },
        });
        if (consumed.count !== 1) throw new Error("STALE_CONFLICT");
        await tx.verificationBusinessFacts.create({
          data: {
            requestId,
            lookupSnapshotId: lookupSnapshot.id,
            applicantLegalName: input.applicantLegalName,
            applicantRegisteredAddress: input.applicantRegisteredAddress,
            operatingAddress: input.operatingAddressDiffers
              ? input.operatingAddress
              : null,
            companyEmail,
            companyEmailVerifiedAt,
            companyEmailFreeProvider: emailSignals.freeProvider,
            companyEmailWebsiteDomainMatch: emailSignals.websiteDomainMatch,
            emailSignalVersion: businessVerificationConfig.emailSignalVersion,
            companyPhoneE164: input.companyPhone,
            companyPhoneVerified: false,
            websiteOrigin: input.website || null,
            relationship: input.relationship,
            currentJobTitle: input.currentJobTitle,
            authorityExplanation: input.authorityExplanation,
            legalNameDiffers,
            registeredAddressDiffers,
            mismatchExplanation: input.mismatchExplanation,
            accuracyDeclaredAt: now,
            documentConsentAt: now,
            policyVersion: input.policyVersion,
            normalizationVersion:
              businessVerificationConfig.normalizationVersion,
          },
        });
        await tx.businessRegistryLookupSnapshot.update({
          where: { id: lookupSnapshot.id },
          data: { acceptedRequestId: requestId, acceptedAt: now },
        });
        const evidence = await tx.businessLicenseEvidence.create({
          data: {
            requestId,
            submissionVersion: 1,
            declaredMediaType: mediaType,
            byteSize: stored.byteSize,
            sourceSha256: stored.sourceSha256,
            storageAdapter: stored.storageAdapter,
            storageLocator: stored.storageLocator,
            encryptionKeyVersion: stored.encryptionKeyVersion,
            iv: stored.iv,
            authenticationTag: stored.authenticationTag,
          },
        });
        await tx.recruiterVerificationRequest.update({
          where: { id: requestId },
          data: { currentEvidenceId: evidence.id },
        });
        await tx.employerVerificationPreparation.update({
          where: { id: preparation.id },
          data: {
            inaccessibleAt: now,
            deleteAfter: new Date(now.getTime() + 24 * 60 * 60_000),
          },
        });
        await tx.emailOutbox.create({
          data: receiptData(
            requestId,
            session.userId,
            "PENDING_CHECKS",
            "VERIFICATION_RECEIPT",
            row.version,
            now,
          ),
        });
        return { requestId: row.id, state: row.state, version: row.version };
      });
    } catch (error) {
      await storage().delete(stored.storageLocator);
      throw error;
    }
  }
  async cancel(request: Request, requestId: string) {
    const now = new Date();
    const session = await requireSession(request.headers, now);
    if (!session) throw new Error("UNAUTHORIZED");
    return prisma.$transaction(async (tx) => {
      const row = await tx.recruiterVerificationRequest.findFirst({
        where: { id: requestId, applicantUserId: session.userId },
      });
      if (
        !row ||
        !["PENDING_CHECKS", "PENDING_REVIEW", "CHANGES_REQUESTED"].includes(
          row.state,
        )
      )
        throw new Error("TARGET_UNAVAILABLE");
      const updated = await tx.recruiterVerificationRequest.update({
        where: { id: row.id },
        data: {
          state: "CANCELLED",
          cancelledAt: now,
          version: { increment: 1 },
          evidence: {
            updateMany: {
              where: { contentInaccessibleAt: null },
              data: {
                contentInaccessibleAt: now,
                deleteAfter: new Date(now.getTime() + 24 * 60 * 60_000),
              },
            },
          },
        },
      });
      await tx.emailOutbox.create({
        data: receiptData(
          row.id,
          session.userId,
          "CANCELLED",
          "VERIFICATION_CANCELLED",
          updated.version,
          now,
        ),
      });
      return {
        requestId: updated.id,
        state: updated.state,
        version: updated.version,
      };
    });
  }
  async resubmit(request: Request, requestId: string, file: File) {
    const now = new Date();
    const session = await requireSession(request.headers, now);
    if (!session) throw new Error("UNAUTHORIZED");
    const mediaType = validateEvidenceFile(file);
    const current = await prisma.recruiterVerificationRequest.findFirst({
      where: {
        id: requestId,
        applicantUserId: session.userId,
        state: "CHANGES_REQUESTED",
        resubmissionCount: { lt: 3 },
      },
    });
    if (!current) throw new Error("TARGET_UNAVAILABLE");
    const version = current.currentSubmissionVersion + 1;
    const stored = await storage().write(
      `${requestId}:${version}`,
      Buffer.from(await file.arrayBuffer()),
    );
    try {
      return await prisma.$transaction(async (tx) => {
        const changed = await tx.recruiterVerificationRequest.updateMany({
          where: {
            id: current.id,
            state: "CHANGES_REQUESTED",
            version: current.version,
          },
          data: {
            state: "RESUBMITTED",
            currentSubmissionVersion: version,
            resubmissionCount: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new Error("STALE_CONFLICT");
        await tx.businessLicenseEvidence.updateMany({
          where: { requestId, contentInaccessibleAt: null },
          data: {
            supersededAt: now,
            contentInaccessibleAt: now,
            deleteAfter: new Date(now.getTime() + 24 * 60 * 60_000),
          },
        });
        const evidence = await tx.businessLicenseEvidence.create({
          data: {
            requestId,
            submissionVersion: version,
            declaredMediaType: mediaType,
            byteSize: stored.byteSize,
            sourceSha256: stored.sourceSha256,
            storageAdapter: stored.storageAdapter,
            storageLocator: stored.storageLocator,
            encryptionKeyVersion: stored.encryptionKeyVersion,
            iv: stored.iv,
            authenticationTag: stored.authenticationTag,
          },
        });
        const result = await tx.recruiterVerificationRequest.update({
          where: { id: requestId },
          data: {
            state: "PENDING_CHECKS",
            currentEvidenceId: evidence.id,
            delayedAt: null,
          },
        });
        await tx.emailOutbox.create({
          data: receiptData(
            requestId,
            session.userId,
            "PENDING_CHECKS",
            "VERIFICATION_RECEIPT",
            result.version,
            now,
          ),
        });
        return { requestId, state: result.state, version: result.version };
      });
    } catch (error) {
      await storage().delete(stored.storageLocator);
      throw error;
    }
  }
}
