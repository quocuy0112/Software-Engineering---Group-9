import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import {
  verificationSubmissionSchema,
  validateEvidenceFile,
} from "@/shared/contracts/admin/verification";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { S3PrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/s3";
import { CompanyRelationshipPrerequisiteGateway } from "./company-relationship-prerequisite-gateway";
function storage() {
  return process.env.ADMIN_EVIDENCE_STORAGE_ADAPTER === "s3"
    ? new S3PrivateBusinessEvidenceStorage()
    : new FilesystemPrivateBusinessEvidenceStorage();
}
function receiptData(
  requestId: string,
  userId: string,
  state: string,
  kind: "VERIFICATION_RECEIVED" | "VERIFICATION_CANCELLED",
  submissionVersion = 1,
) {
  return {
    kind,
    userId,
    verificationRequestId: requestId,
    recipientRef: userId,
    templateVersion: "verification-v1",
    payloadRef: {
      requestId,
      resultingState: state,
      nextAction:
        state === "CANCELLED" ? "SUBMIT_NEW_REQUEST" : "WAIT_FOR_REVIEW",
    },
    idempotencyKey: `verification:${requestId}:${kind.toLowerCase()}:v${submissionVersion}`,
    status: "PENDING" as const,
    nextAttemptAt: new Date(),
  };
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
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  async submit(request: Request, raw: unknown, file: File) {
    const now = new Date();
    const session = await requireSession(request.headers, now);
    if (!session) throw new Error("UNAUTHORIZED");
    const input = verificationSubmissionSchema.parse(raw);
    const mediaType = validateEvidenceFile(file);
    const bytes = Buffer.from(await file.arrayBuffer());
    const requestId = randomUUID();
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
            applicantUserId: session.userId,
            submittedCompanyName: input.companyName,
            normalizedTaxIdentifier: input.taxIdentifier,
            targetCompanyId: existing?.id,
            requestedRole: input.requestedRole,
            prerequisiteId: input.prerequisiteId,
          },
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
        await tx.emailOutbox.create({
          data: receiptData(
            requestId,
            session.userId,
            "PENDING_CHECKS",
            "VERIFICATION_RECEIVED",
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
            "VERIFICATION_RECEIVED",
            version,
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
